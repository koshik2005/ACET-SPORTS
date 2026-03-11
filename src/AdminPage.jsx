import { useState, useEffect, useRef } from "react";
import { useIsMobile, hi, tint, Sheet } from "./utils.jsx";
import { ImgUploadBtn } from "./ImgUploadBtn.jsx";
import { ImageCropper } from "./ImageCropper.jsx";
import { API_BASE } from "./api.js";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";

const EMPTY_AUTH = { role: "Sports Official", name: "", designation: "", email: "", img: null, priority: 5 };

export function AdminPage({
    dark,
    houses, setHouses,
    authorities, setAuthorities,
    management, setManagement,
    studentCommittee, setStudentCommittee,
    games, setGames,
    gallery, setGallery,
    registrations, setRegistrations,
    pointLog, setPointLog,
    studentsDB, setStudentsDB,
    results, setResults,
    nav, setNav,
    sportGamesList, setSportGamesList,
    sportGamesListWomens, setSportGamesListWomens,
    staffGamesList, setStaffGamesList,
    staffGamesListWomens, setStaffGamesListWomens,
    athleticsList, setAthleticsList,
    athleticsListWomens, setAthleticsListWomens,
    authorityRoles, setAuthorityRoles,
    managementRoles, setManagementRoles,
    registrationOpen, setRegistrationOpen,
    registrationCloseTime, setRegistrationCloseTime,
    eventDate, setEventDate,
    starPlayers, setStarPlayers,
    emptyGame,
    closedEvents, setClosedEvents,
    maxGames, setMaxGames,
    maxAthletics, setMaxAthletics
}) {
    const [loggedIn, setLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [loginStep, setLoginStep] = useState("email"); // "email" | "password" | "otp"
    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [tab, setTab] = useState("Gallery");
    const [exportType, setExportType] = useState("All");
    const [exportVal, setExportVal] = useState("All");
    const isMobile = useIsMobile();

    const [winner, setWinner] = useState({ first: "", second: "", third: "", eventType: "game", eventName: "", firstPlayer: "", secondPlayer: "", thirdPlayer: "" });
    const [winnerSet, setWinnerSet] = useState(false);
    const [manualPts, setManualPts] = useState({ house: houses[0]?.name || "", pts: "", reason: "" });
    const [ptMsg, setPtMsg] = useState("");
    const [adminGames, setAdminGames] = useState(games);
    const [gameModal, setGameModal] = useState(null);
    const [delGameId, setDelGameId] = useState(null);
    const [gameForm, setGameForm] = useState(emptyGame);
    useEffect(() => setAdminGames(games), [games]);
    const [editReg, setEditReg] = useState(null);
    const [editRegForm, setEditRegForm] = useState({ game: "", athletic: "" });
    const galleryInputRef = useRef();
    const [galForm, setGalForm] = useState({ category: "current", label: "" });
    const [galFile, setGalFile] = useState(null);
    const [galUploading, setGalUploading] = useState(false);
    const [authModal, setAuthModal] = useState(null);
    const [authForm, setAuthForm] = useState(EMPTY_AUTH);
    const [xlPreview, setXlPreview] = useState(null); // parsed rows before confirm
    const [xlError, setXlError] = useState("");
    const [xlDrag, setXlDrag] = useState(false);
    const xlInputRef = useRef();
    const [emailStatus, setEmailStatus] = useState({}); // key: `${houseId}-${captainKey}` → idle|sending|sent|error
    const [announcementStatus, setAnnouncementStatus] = useState("idle"); // idle|sending|sent|error
    const [invitationFile, setInvitationFile] = useState(null);
    const [invitationFileName, setInvitationFileName] = useState("");
    const [portalUrl, setPortalUrl] = useState(window.location.origin + "/captain");
    const [confirmDelete, setConfirmDelete] = useState(null);

    const [managementModal, setManagementModal] = useState(null);
    const [managementForm, setManagementForm] = useState(EMPTY_AUTH);

    const [committeeModal, setCommitteeModal] = useState(null);
    const [committeeForm, setCommitteeForm] = useState(EMPTY_AUTH);

    const [tsHouse, setTsHouse] = useState("All");
    const [tsGender, setTsGender] = useState("All");
    const [tsStatus, setTsStatus] = useState("All"); // All, Issued, Pending

    // Winners tab filters
    const [wfPrize, setWfPrize] = useState("All");  // All | 1st | 2nd | 3rd
    const [wfEvent, setWfEvent] = useState("All");  // All | specific event name
    const [wfHouse, setWfHouse] = useState("All");  // All | house name

    const [starPlayerForm, setStarPlayerForm] = useState({ name: "", dept: "", year: "", game: "", house: "", img: null });
    const [spUploading, setSpUploading] = useState(false);

    const TABS = ["Gallery", "Star Players", "Houses", "Authorities", "Management", "Committee", "Games", "Registrations", "Winners", "Points", "Students", "T-Shirts", "Settings", "Exports", "Config"];
    const [studentSearch, setStudentSearch] = useState("");
    const [editingRegNo, setEditingRegNo] = useState(null);
    const [editStudentForm, setEditStudentForm] = useState({});
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [addStudentForm, setAddStudentForm] = useState({ name: "", regNo: "", email: "", gender: "Male", house: "", year: "", dept: "", shirtSize: "" });
    const [showBulkImport, setShowBulkImport] = useState(studentsDB.length === 0);
    const [studentPage, setStudentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Helper: parse a combined "year dept" value like "II AI&DS", "I(cse a)", "III MECH A"
    const parseYearDept = (raw) => {
        if (!raw) return { year: "", dept: "" };
        const str = raw.trim();
        // Match leading Roman numeral I–IV (4-year program), longest match first
        const match = str.match(/^(IV|III|II|I)\s*[\s(/,-]?\s*(.*)$/i);
        if (match) {
            const year = match[1].toUpperCase();
            // Clean up dept: remove surrounding parens, normalise spaces, uppercase
            let dept = (match[2] || "").replace(/^\(|\)$/g, "").trim().toUpperCase();
            return { year, dept };
        }
        // No leading Roman numeral — return raw as dept
        return { year: "", dept: str.toUpperCase() };
    };

    const parseFile = (file, isStaffUpload = false) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: "binary" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
                if (raw.length === 0) { setXlError("File is empty or has no rows."); return; }
                // Normalise keys: lowercase + trim
                const rows = raw.map(r => {
                    const n = {};
                    Object.entries(r).forEach(([k, v]) => { n[k.toLowerCase().trim()] = String(v).trim(); });

                    // Detect combined year+dept column (e.g. "II AI&DS", "I(cse a)")
                    // It may come under keys: "year", "class", "department", "dept", "year/dept", "class/dept"
                    const combinedRaw = n["year/dept"] || n["class/dept"] || n["year dept"] || n["class dept"] || "";
                    let rawYear = n.year || n.class || n.batch || n.y || "";
                    let rawDept = n.dept || n.department || n.branch || n.course || "";

                    // If combined column found, parse it
                    if (combinedRaw) {
                        const parsed = parseYearDept(combinedRaw);
                        if (!rawYear) rawYear = parsed.year;
                        if (!rawDept) rawDept = parsed.dept;
                    } else if (rawYear && !rawDept) {
                        // year column may actually hold combined value like "II AI&DS"
                        const parsed = parseYearDept(rawYear);
                        if (parsed.dept) { rawYear = parsed.year; rawDept = parsed.dept; }
                    } else if (!rawYear && rawDept) {
                        // dept column may hold combined value
                        const parsed = parseYearDept(rawDept);
                        if (parsed.year) { rawYear = parsed.year; rawDept = parsed.dept; }
                    }

                    return {
                        sno: n["s.no"] || n.sno || n.sn || "",
                        name: n.name || n["student name"] || n["full name"] || "",
                        email: n.email || n["email id"] || n["mail"] || "",
                        regNo: n.regno || n["reg.no"] || n["register number"] || n["id"] || n.mobile || "",
                        house: n.house || n["house name"] || "",
                        year: rawYear,
                        dept: rawDept,
                        shirtSize: n["t-shirt size"] || n["tshirt size"] || n["tshirt"] || n.size || "",
                        gender: n.gender || n.sex || n.g || n.mf || n["m/f"] || "",
                        shirtIssued: false,
                        role: isStaffUpload ? "Staff" : (n.role || "Student")
                    };
                }).filter(r => r.name || r.email || r.regNo);
                if (rows.length === 0) { setXlError(`Could not find required columns. Ensure headers match: s.no, name, reg.no, email, ${isStaffUpload ? 'gender, department' : 'year/department, house, gender, t-shirt size'}.`); return; }
                setXlPreview(rows);
            } catch (e) { setXlError("Failed to read file: " + e.message); }
        };
        reader.readAsBinaryString(file);
    };

    const handleEmailNext = () => {
        if (!adminEmail || !adminEmail.includes("@")) {
            setLoginError("Please enter a valid Admin Email address");
            return;
        }
        setLoginError("");
        setAdminPassword("");
        setLoginStep("password");
    };

    const handleVerifyPassword = async () => {
        if (!adminPassword) {
            setLoginError("Please enter the Admin Password");
            return;
        }
        setLoginError(""); setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin-verify-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword })
            });
            const data = await res.json();
            if (data.success) {
                // Password OK — now send OTP
                const otpRes = await fetch(`${API_BASE}/api/admin-send-otp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: adminEmail.trim() })
                });
                const otpData = await otpRes.json();
                if (otpData.success) {
                    setOtp("");
                    setLoginStep("otp");
                } else {
                    setLoginError(otpData.error || "Failed to send OTP.");
                }
            } else {
                setLoginError(data.error || "Incorrect password.");
            }
        } catch (err) {
            console.error("PASSWORD VERIFY ERROR:", err);
            setLoginError(`Failed to reach server: ${err.message}`);
        }
        setIsVerifying(false);
    };

    const handleLogin = async () => {
        setLoginError(""); setIsVerifying(true);
        if (!adminEmail.trim()) {
            setLoginError("Admin Email is required");
            setIsVerifying(false);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/admin-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail.trim(), otp })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem("adminToken", data.token);

                // Fetch the secure state that includes everything
                const secureRes = await fetch(`${API_BASE}/api/secure-state`, {
                    headers: { "Authorization": `Bearer ${data.token}` }
                });
                const secureData = await secureRes.json();

                if (secureData.houses) props.setHouses(secureData.houses);
                if (secureData.studentsDB) props.setStudentsDB(secureData.studentsDB);
                if (secureData.pointLog) props.setPointLog(secureData.pointLog);
                if (secureData.registrations) props.setRegistrations(secureData.registrations);
                if (secureData.authorities) props.setAuthorities(secureData.authorities);
                if (secureData.management) props.setManagement(secureData.management);
                if (secureData.studentCommittee) props.setStudentCommittee(secureData.studentCommittee);
                if (secureData.games) props.setGames(secureData.games);
                if (secureData.gallery) props.setGallery(secureData.gallery);
                if (secureData.results) props.setResults(secureData.results);
                if (secureData.starPlayers) props.setStarPlayers(secureData.starPlayers);

                setLoggedIn(true);
            } else {
                setLoginError(data.error || "Incorrect OTP");
            }
        } catch (err) {
            console.error("ADMIN LOGIN ERROR:", err);
            setLoginError(`Failed to reach server: ${err.message}`);
        }
        setIsVerifying(false);
    };

    const sendCaptainEmail = async (house, captainKey, roleLabel) => {
        const c = house[captainKey];
        if (!c?.email || !c?.password) return;
        const statusKey = `${house.id}-${captainKey}`;
        setEmailStatus(s => ({ ...s, [statusKey]: "sending" }));
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${API_BASE}/api/send-captain-email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    captainName: c.name || "Captain",
                    captainEmail: c.email,
                    password: c.password,
                    house: house.name,
                    role: roleLabel,
                    portalUrl,
                    authorities: [...authorities, ...management],
                    studentsDB
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            setEmailStatus(s => ({ ...s, [statusKey]: "sent" }));
            setTimeout(() => setEmailStatus(s => ({ ...s, [statusKey]: "idle" })), 4000);
        } catch (e) {
            setEmailStatus(s => ({ ...s, [statusKey]: "error:" + e.message }));
            setTimeout(() => setEmailStatus(s => ({ ...s, [statusKey]: "idle" })), 5000);
        }
    };

    const sendAnnouncementEmail = async () => {
        if (!window.confirm("Are you sure you want to email EVERY registered student and authority about the Sports Day schedule?")) return;
        if (!eventDate?.date) {
            alert("Please set the Event Date first in the Config tab.");
            return;
        }
        setAnnouncementStatus("sending");
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${API_BASE}/api/send-event-announcement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    date: eventDate.date,
                    time: eventDate.time,
                    portalUrl,
                    authorities: [...authorities, ...management],
                    studentsDB,
                    invitationFile,
                    invitationFileName,
                    regardsNames: authorities.map(a => a.name).join(", ")
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            setAnnouncementStatus("sent");
            setTimeout(() => setAnnouncementStatus("idle"), 4000);
        } catch (e) {
            setAnnouncementStatus("error:" + e.message);
            setTimeout(() => setAnnouncementStatus("idle"), 5000);
        }
    };

    const getHouseNames = (state) => {
        return state.houses.map(h => h.name);
    };

    const exportAdminExcel = () => {
        const filtered = registrations.filter(r => {
            if (exportType === "All") return true;
            if (exportType === "Game") {
                if (!r.game) return false;                          // must have a game
                return exportVal === "All" || r.game === exportVal;
            }
            if (exportType === "Athletic") {
                if (!r.athletic) return false;                      // must have an athletic event
                return exportVal === "All" || r.athletic === exportVal;
            }
            return true;
        });

        const data = filtered.map((r, i) => {
            const student = studentsDB.find(s => s.regNo === r.regNo);
            return {
                "S.No": i + 1,
                "Name": r.name,
                "Year": student?.year || "N/A",
                "Department": student?.dept || "—",
                "Team": r.house,
                "Game": r.game || "—",
                "Athletic Event": r.athletic || "—",
                "Registered At": r.registeredAt
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MasterParticipation");
        XLSX.writeFile(wb, `Master_Participation_${exportVal}.xlsx`);
    };

    const exportMasterRoster = () => {
        const data = studentsDB.map((s, i) => {
            const reg = registrations.find(r => r.regNo === s.regNo);
            return {
                "S.No": s.sno || i + 1,
                "Name": s.name,
                "Register No": s.regNo,
                "Email": s.email,
                "Year": s.year || "N/A",
                "Department": s.dept || "—",
                "Gender": s.gender || "—",
                "House": s.house,
                "T-Shirt Size": s.shirtSize || "—",
                "T-Shirt Issued": s.shirtIssued ? "✅ ISSUED" : "❌ PENDING",
                "Status": reg ? "✅ REGISTERED" : "❌ PENDING",
                "Game": reg?.game || "—",
                "Athletic Event": reg?.athletic || "—",
                "Registration Time": reg ? reg.registeredAt : "—"
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MasterRoster");
        XLSX.writeFile(wb, `Master_Roster_Full.xlsx`);
    };

    const exportFilteredTShirts = () => {
        const list = studentsDB.filter(s => {
            if (tsHouse !== "All" && s.house !== tsHouse) return false;
            if (tsGender !== "All" && (s.gender || "").toLowerCase() !== tsGender.toLowerCase()) return false;
            if (tsStatus === "Issued" && !s.shirtIssued) return false;
            if (tsStatus === "Pending" && s.shirtIssued) return false;
            return true;
        });

        const data = list.map((s, i) => ({
            "S.No": s.sno || i + 1,
            "Name": s.name,
            "Register No": s.regNo,
            "Gender": s.gender || "—",
            "Year": s.year || "N/A",
            "Department": s.dept || "—",
            "House": s.house,
            "T-Shirt Size": s.shirtSize || "—",
            "T-Shirt Status": s.shirtIssued ? "✅ ISSUED" : "❌ PENDING"
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TShirt_Inventory");
        XLSX.writeFile(wb, `TShirt_List_${tsHouse}_${tsGender}_${tsStatus}.xlsx`);
    };

    const fetchImageBuffer = async (url) => {
        if (!url) return null;
        try {
            if (url.startsWith('data:image')) {
                const base64Data = url.split(',')[1];
                const binaryString = window.atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes.buffer;
            } else {
                const res = await fetch(url);
                const blob = await res.blob();
                return await blob.arrayBuffer();
            }
        } catch (e) {
            console.error("Failed to fetch image:", e);
            return null;
        }
    };

    const exportFinalReport = async () => {
        // Build participants list by gender
        const menStudents = studentsDB.filter(s => s.gender && (s.gender.toLowerCase() === "male" || s.gender.toLowerCase() === "m"));
        const womenStudents = studentsDB.filter(s => s.gender && (s.gender.toLowerCase() === "female" || s.gender.toLowerCase() === "f"));

        // Helper to get image run or placeholder text
        const createProfileImage = async (url, fallbackText) => {
            const buf = await fetchImageBuffer(url);
            if (buf) {
                return new Paragraph({
                    children: [new ImageRun({ data: buf, transformation: { width: 80, height: 80 } })],
                    alignment: AlignmentType.CENTER
                });
            }
            return new Paragraph({ text: fallbackText, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, space: 1, color: "auto" }, bottom: { style: BorderStyle.SINGLE, space: 1, color: "auto" }, left: { style: BorderStyle.SINGLE, space: 1, color: "auto" }, right: { style: BorderStyle.SINGLE, space: 1, color: "auto" } } });
        };

        const docChildren = [];

        // 1. Header (Logos and Titles)
        docChildren.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "[ACET LOGO]", alignment: AlignmentType.CENTER })] }),
                            new TableCell({
                                width: { size: 60, type: WidthType.PERCENTAGE },
                                children: [
                                    new Paragraph({ text: "ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                                    new Paragraph({ text: "(Approved by AICTE and Affiliated to Pondicherry University)", alignment: AlignmentType.CENTER }),
                                    new Paragraph({ text: "An ISO 9001: 2008 Certified Institution", alignment: AlignmentType.CENTER }),
                                    new Paragraph({ text: "Achariyapuram, Villianur, Puducherry – 605 110.", alignment: AlignmentType.CENTER })
                                ]
                            }),
                            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "[WORLD CLASS LOGO]", alignment: AlignmentType.CENTER })] })
                        ]
                    })
                ]
            }),
            new Paragraph({ text: `ANNUAL SPORTS MEET ${eventDate?.date?.split("-")[0] || new Date().getFullYear()}`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 100 } }),
            new Paragraph({ text: "DEPARTMENT OF PHYSICAL EDUCATION AND TRAINING", heading: HeadingLevel.HEADING_3, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
            new Paragraph({ text: `Date: ${eventDate?.date || "—"}\nPlace: ACET Campus`, spacing: { after: 400 } })
        );

        // 2. People Sections Generator (Sports Authority, Management, Captains)
        const addPeopleGrid = (title, peopleList, roleExtractor = p => p.role, extraDetails = p => p.designation) => {
            if (!peopleList || peopleList.length === 0) return;
            docChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }));

            // Group into rows of 2 for simplicity, unless it's just 1
            const rows = [];
            for (let i = 0; i < peopleList.length; i += 2) {
                const p1 = peopleList[i];
                const p2 = peopleList[i + 1];

                const cells = [];
                cells.push(new TableCell({
                    width: { size: p2 ? 50 : 100, type: WidthType.PERCENTAGE },
                    children: [
                        new Paragraph({ text: "[IMAGE]", alignment: AlignmentType.CENTER }), // Placeholder: we skip async image loading here for simplicity to avoid huge code blocks
                        new Paragraph({ text: p1.name, bold: true, alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: roleExtractor(p1), italics: true, alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: extraDetails(p1), alignment: AlignmentType.CENTER })
                    ]
                }));
                if (p2) {
                    cells.push(new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ text: "[IMAGE]", alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: p2.name, bold: true, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: roleExtractor(p2), italics: true, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: extraDetails(p2), alignment: AlignmentType.CENTER })
                        ]
                    }));
                }

                rows.push(new TableRow({ children: cells }));
            }

            docChildren.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                rows
            }));
        };

        addPeopleGrid("Sports Authority", authorities);
        addPeopleGrid("Management", management);

        // Captains
        const captains = [];
        houses.forEach(h => {
            if (h.boysCaptain?.name) captains.push({ ...h.boysCaptain, role: `Captain (Men) - ${h.name} House`, designation: `${h.boysCaptain.year} ${h.boysCaptain.dept}` });
            if (h.girlsCaptain?.name) captains.push({ ...h.girlsCaptain, role: `Captain (Women) - ${h.name} House`, designation: `${h.girlsCaptain.year} ${h.girlsCaptain.dept}` });
            if (h.viceCaptainBoys?.name) captains.push({ ...h.viceCaptainBoys, role: `Vice Captain (Men) - ${h.name} House`, designation: `${h.viceCaptainBoys.year} ${h.viceCaptainBoys.dept}` });
            if (h.viceCaptainGirls?.name) captains.push({ ...h.viceCaptainGirls, role: `Vice Captain (Women) - ${h.name} House`, designation: `${h.viceCaptainGirls.year} ${h.viceCaptainGirls.dept}` });
        });
        addPeopleGrid("House Captains", captains);

        // 3. Students Table
        docChildren.push(new Paragraph({ text: "Total Students List", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 800, after: 200 }, pageBreakBefore: true }));
        const studentRows = studentsDB.map((s, i) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(String(i + 1))] }),
                new TableCell({ children: [new Paragraph(s.regNo)] }),
                new TableCell({ children: [new Paragraph(s.name)] }),
                new TableCell({ children: [new Paragraph(s.year || "")] }),
                new TableCell({ children: [new Paragraph(s.dept || "")] }),
                new TableCell({ children: [new Paragraph(s.house)] }),
            ]
        }));

        docChildren.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: ["S.No", "Reg No", "Name", "Year", "Dept", "House"].map(t => new TableCell({ children: [new Paragraph({ text: t, bold: true })] }))
                }),
                ...studentRows
            ]
        }));

        // 4. Games Tables
        const addAthletesTable = (title, list, genderName) => {
            docChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }));
            const rRows = registrations.filter(r => {
                const s = studentsDB.find(st => st.regNo === r.regNo);
                return s && (s.gender?.toLowerCase().startsWith(genderName.toLowerCase()[0]));
            }).map((r, i) => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(String(i + 1))] }),
                    new TableCell({ children: [new Paragraph(r.game || r.athletic || "—")] }),
                    new TableCell({ children: [new Paragraph(`${r.name} (${r.regNo})`)] }),
                ]
            }));

            if (rRows.length > 0) {
                docChildren.push(new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: ["S.No", "Game / Event", `Athlete (${genderName})`].map(t => new TableCell({ children: [new Paragraph({ text: t, bold: true })] })) }),
                        ...rRows
                    ]
                }));
            } else {
                docChildren.push(new Paragraph({ text: "No registrations found.", italics: true }));
            }
        };

        addAthletesTable("Men's Games Participant List", registrations, "Men");
        addAthletesTable("Women's Games Participant List", registrations, "Women");

        // 5. Winners Side-by-Side Table (Using Layout Grid)
        docChildren.push(new Paragraph({ text: "Winners List", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 }, pageBreakBefore: true }));

        // This splits games by checking participant gender in the results, or implicitly by name
        // For simplicity in this layout, we list the event names found in the results.
        const winMens = [];
        const winWomens = [];

        // Filter results into Mens vs Womens lists if they have "Men" or "Women" in their eventName,
        // or just split them all side by side.
        results.forEach(res => {
            if (res.eventName.toLowerCase().includes("women") || res.eventName.toLowerCase().includes("girl")) {
                winWomens.push(res);
            } else {
                winMens.push(res);
            }
        });

        const maxLen = Math.max(winMens.length, winWomens.length);
        const winnersGridRows = [];

        winnersGridRows.push(new TableRow({
            children: [
                new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Men's Winners", bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } }, children: [new Paragraph("")] }), // spacer
                new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Women's Winners", bold: true, alignment: AlignmentType.CENTER })] })
            ]
        }));

        for (let i = 0; i < maxLen; i++) {
            const m = winMens[i];
            const w = winWomens[i];

            const cellM = new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, children: [] });
            if (m) {
                cellM.options.children.push(
                    new Paragraph({ text: m.eventName, bold: true, alignment: AlignmentType.CENTER }),
                    new Paragraph({ text: `1st: ${m.placements?.first?.player || m.placements?.first?.house || "—"}` }),
                    new Paragraph({ text: `2nd: ${m.placements?.second?.player || m.placements?.second?.house || "—"}` }),
                    new Paragraph({ text: `3rd: ${m.placements?.third?.player || m.placements?.third?.house || "—"}` })
                );
            }

            const cellW = new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, children: [] });
            if (w) {
                cellW.options.children.push(
                    new Paragraph({ text: w.eventName, bold: true, alignment: AlignmentType.CENTER }),
                    new Paragraph({ text: `1st: ${w.placements?.first?.player || w.placements?.first?.house || "—"}` }),
                    new Paragraph({ text: `2nd: ${w.placements?.second?.player || w.placements?.second?.house || "—"}` }),
                    new Paragraph({ text: `3rd: ${w.placements?.third?.player || w.placements?.third?.house || "—"}` })
                );
            }

            winnersGridRows.push(new TableRow({
                children: [
                    cellM,
                    new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } }, children: [new Paragraph("")] }),
                    cellW
                ]
            }));
        }

        docChildren.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
            rows: winnersGridRows
        }));

        // 6. Greeting Message & Signatures
        docChildren.push(
            new Paragraph({ text: "It is with great pride and immense joy that we conclude this year's Annual Sports Meet. The dedication, sportsmanship, and unyielding spirit displayed by all participants have truly made this event memorable. Congratulations to all the winners for their outstanding achievements, and a hearty round of applause to every athlete who gave their best on the field.", spacing: { before: 800 } }),
            new Paragraph({ text: "We extend our deepest gratitude to the Management, Sports Authorities, Faculty, and Student Committees for their tireless efforts in organizing this spectacular event. Your unwavering support and commitment to fostering a culture of excellence in sports are what make our institution a beacon of holistic education.", spacing: { before: 200, after: 1200 } }),

            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Physical Education Director", bold: true, alignment: AlignmentType.LEFT })] }),
                            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Principal", bold: true, alignment: AlignmentType.RIGHT })] })
                        ]
                    })
                ]
            })
        );

        const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });

        Packer.toBlob(doc).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Achariya_Sports_Final_Report_${new Date().getFullYear()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
    };

    const exportWinners = (filteredList) => {
        const list = filteredList || results;
        if (list.length === 0) { alert("No results to export for the selected filters."); return; }
        const prizeLabel = wfPrize === "All" ? "All" : wfPrize;
        const data = list.map((res, i) => ({
            "S.No": i + 1,
            "Event Name": res.eventName || "Unnamed",
            "Event Type": res.eventType === "game" ? "Team Game" : res.eventType === "athletic" ? "Athletic" : "Custom",
            "🥇 1st Place — House": res.placements?.first?.house || "—",
            "🥇 1st Place — Player / Captain": res.placements?.first?.player || "—",
            "🥈 2nd Place — House": res.placements?.second?.house || "—",
            "🥈 2nd Place — Player / Captain": res.placements?.second?.player || "—",
            "🥉 3rd Place — House": res.placements?.third?.house || "—",
            "🥉 3rd Place — Player / Captain": res.placements?.third?.player || "—",
            "Recorded At": res.time || "—",
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const colWidths = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length, 20) }));
        ws["!cols"] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Winners");
        const suffix = [wfPrize !== "All" ? wfPrize : "", wfHouse !== "All" ? wfHouse : "", wfEvent !== "All" ? wfEvent : ""].filter(Boolean).join("_") || "All";
        XLSX.writeFile(wb, `Winners_${suffix}_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`);
    };

    const iS = { width: "100%", padding: "11px 14px", borderRadius: 8, fontSize: 16, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#2a2a3e" : "#f8f8f8", color: dark ? "#fff" : "#333", boxSizing: "border-box", marginBottom: 12 };
    const lS = { display: "block", fontWeight: 600, color: dark ? "#ccc" : "#555", marginBottom: 6, fontSize: 13 };
    const cS = { background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: isMobile ? 14 : 24 };

    if (!loggedIn) {
        const stepLabels = ["Email", "Password", "OTP"];
        const stepIdx = loginStep === "email" ? 0 : loginStep === "password" ? 1 : 2;
        return (
            <div style={{ maxWidth: 400, margin: isMobile ? "24px auto" : "80px auto", padding: isMobile ? "16px 14px" : "40px 20px" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: 48 }}>🔐</div>
                    <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", fontSize: isMobile ? 20 : 24 }}>Admin Login</h2>
                    {/* Step indicators */}
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 10 }}>
                        {stepLabels.map((label, i) => {
                            const done = i < stepIdx;
                            const active = i === stepIdx;
                            return (
                                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? "#2E8B57" : active ? "#8B0000" : dark ? "#444" : "#ddd", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .3s" }}>
                                        {done ? "✓" : i + 1}
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: active ? (dark ? "#fff" : "#8B0000") : done ? "#2E8B57" : dark ? "#666" : "#bbb" }}>{label}</span>
                                    {i < 2 && <span style={{ color: dark ? "#555" : "#ccc", fontSize: 14 }}>›</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={cS}>
                    {/* Step 1: Email */}
                    {loginStep === "email" && (
                        <>
                            <label style={lS}>Admin Email</label>
                            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleEmailNext()}
                                placeholder="Enter Admin Email" style={{ ...iS, marginBottom: 12 }} autoFocus />
                            {loginError && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠ {loginError}</div>}
                            <button onClick={handleEmailNext} style={{ width: "100%", background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: "pointer", fontWeight: 700, fontSize: 16 }}>Next →</button>
                        </>
                    )}
                    {/* Step 2: Password */}
                    {loginStep === "password" && (
                        <>
                            <div style={{ fontSize: 13, color: dark ? "#aaa" : "#555", marginBottom: 12, textAlign: "center" }}>Enter admin password for <strong>{adminEmail}</strong></div>
                            <label style={lS}>Admin Password</label>
                            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleVerifyPassword()}
                                placeholder="Enter Admin Password" style={{ ...iS, marginBottom: 8 }} autoFocus />
                            {loginError && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠ {loginError}</div>}
                            <button onClick={handleVerifyPassword} disabled={isVerifying} style={{ width: "100%", background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: isVerifying ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 16 }}>
                                {isVerifying ? "Verifying..." : "Verify & Send OTP"}
                            </button>
                            <button onClick={() => { setLoginStep("email"); setAdminPassword(""); setLoginError(""); }} style={{ width: "100%", background: "transparent", color: "#1E90FF", border: "none", marginTop: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Back</button>
                        </>
                    )}
                    {/* Step 3: OTP */}
                    {loginStep === "otp" && (
                        <>
                            <div style={{ fontSize: 13, color: dark ? "#aaa" : "#555", marginBottom: 12, textAlign: "center" }}>Enter the 6-digit code sent to <strong>{adminEmail}</strong></div>
                            <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleLogin()}
                                maxLength={6} placeholder="······" style={{ ...iS, marginBottom: 8, textAlign: "center", letterSpacing: 6, fontSize: 24, fontWeight: 800 }} autoFocus />
                            {loginError && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠ {loginError}</div>}
                            <button onClick={handleLogin} disabled={isVerifying || otp.length < 6} style={{ width: "100%", background: "#2E8B57", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: (isVerifying || otp.length < 6) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 16 }}>
                                {isVerifying ? "Verifying..." : "Login"}
                            </button>
                            <button onClick={() => { setLoginStep("password"); setOtp(""); setLoginError(""); }} style={{ width: "100%", background: "transparent", color: "#1E90FF", border: "none", marginTop: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Back</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "14px 12px" : "40px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 14 : 28, gap: 8 }}>
                <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: 0, fontSize: isMobile ? 19 : 26 }}>⚙ Admin Dashboard</h1>
                <button onClick={() => { localStorage.removeItem("adminToken"); setLoggedIn(false); window.location.reload(); }} style={{ background: "transparent", border: "1px solid #c00", color: "#c00", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>Logout</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: isMobile ? 18 : 32, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch", width: "100%", scrollbarWidth: "thin" }}>
                {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: isMobile ? "8px 16px" : "10px 22px", borderRadius: 50, cursor: "pointer", fontWeight: 700, fontSize: isMobile ? 13 : 14, background: tab === t ? "#8B0000" : "transparent", color: tab === t ? "#fff" : dark ? "#ccc" : "#555", border: `2px solid ${tab === t ? "#8B0000" : dark ? "#444" : "#ddd"}`, whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>{t}</button>)}
            </div>

            {tab === "Gallery" && (
                <div>
                    <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>📸 Gallery Management</h3>
                    <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 14 }}>{gallery.length} images uploaded</div>
                    <div style={{ ...cS, marginBottom: 18 }}>
                        <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Upload New Image</h4>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div><label style={lS}>Category</label>
                                <select value={galForm.category} onChange={e => setGalForm(f => ({ ...f, category: e.target.value }))} style={iS}>
                                    <option value="current">📸 Current Year</option>
                                    <option value="previous">🏆 Previous Years</option>
                                </select></div>
                            <div><label style={lS}>Caption</label>
                                <input value={galForm.label} onChange={e => setGalForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Football Final 2025" style={iS} /></div>
                        </div>
                        <input type="file" accept="image/*" ref={galleryInputRef} style={{ display: "none" }} onChange={e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => setGalFile({ src: ev.target.result, name: file.name }); reader.readAsDataURL(file); e.target.value = ""; }} />
                        {galFile && !galFile.cropped && (
                            <ImageCropper
                                image={galFile.src}
                                onCancel={() => setGalFile(null)}
                                onCropComplete={(croppedData) => setGalFile({ ...galFile, src: croppedData, cropped: true })}
                                dark={dark}
                            />
                        )}
                        {galFile && galFile.cropped ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                <img src={galFile.src} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", border: `2px solid ${dark ? "#444" : "#ddd"}`, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: dark ? "#ccc" : "#333", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{galFile.name}</div><div style={{ fontSize: 12, color: dark ? "#888" : "#aaa" }}>Ready to upload</div></div>
                                <button onClick={() => setGalFile(null)} style={{ background: "transparent", border: "none", color: dark ? "#aaa" : "#999", cursor: "pointer", fontSize: 20, flexShrink: 0 }}>✕</button>
                            </div>
                        ) : (
                            <div onClick={() => galleryInputRef.current?.click()} style={{ border: `2px dashed ${dark ? "#444" : "#ccc"}`, borderRadius: 10, padding: isMobile ? 18 : 28, textAlign: "center", cursor: "pointer", marginBottom: 10, background: dark ? "rgba(255,255,255,.02)" : "#fafafa" }}>
                                <div style={{ fontSize: 28, marginBottom: 5 }}>📁</div>
                                <div style={{ color: dark ? "#888" : "#aaa", fontSize: 14 }}>Tap to choose an image</div>
                                <div style={{ color: dark ? "#666" : "#bbb", fontSize: 11, marginTop: 2 }}>JPG, PNG, GIF, WEBP</div>
                            </div>
                        )}
                        <button
                            onClick={async () => {
                                if (!galFile || galUploading) return;
                                setGalUploading(true);
                                try {
                                    const token = localStorage.getItem("adminToken");
                                    const res = await fetch(`${API_BASE}/api/upload-image`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                        body: JSON.stringify({ data: galFile.src, folder: "acet-sports/gallery" }),
                                    });
                                    const result = await res.json();
                                    if (!res.ok) throw new Error(result.error || "Upload failed");
                                    // Store Cloudinary URL (not base64) — works on any device!
                                    setGallery(imgs => [...imgs, { ...galForm, src: result.url, id: Date.now(), label: galForm.label || galFile.name }]);
                                    setGalFile(null);
                                    setGalForm({ category: "current", label: "" });
                                } catch (e) {
                                    alert("❌ Upload failed: " + e.message + "\n\nFallback: storing image locally (will only show on this device).");
                                    // Fallback: store base64 if Cloudinary not configured
                                    setGallery(imgs => [...imgs, { ...galForm, src: galFile.src, id: Date.now(), label: galForm.label || galFile.name }]);
                                    setGalFile(null);
                                    setGalForm({ category: "current", label: "" });
                                } finally {
                                    setGalUploading(false);
                                }
                            }}
                            disabled={!galFile || galUploading}
                            style={{ background: (galFile && !galUploading) ? "linear-gradient(135deg,#8B0000,#C41E3A)" : "#ccc", color: "#fff", border: "none", borderRadius: 50, padding: "11px 24px", cursor: (galFile && !galUploading) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 14 }}
                        >
                            {galUploading ? "⏳ Uploading to Cloud..." : "➕ Add to Gallery"}
                        </button>
                    </div>
                    {["current", "previous"].map(cat => {
                        const imgs = gallery.filter(g => g.category === cat);
                        return (
                            <div key={cat} style={{ marginBottom: 22 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 13 }}>{cat === "current" ? "📸 Current Year" : "🏆 Previous Years"} ({imgs.length})</h4>
                                {imgs.length === 0
                                    ? <div style={{ padding: 16, color: dark ? "#666" : "#aaa", fontSize: 13, background: dark ? "rgba(255,255,255,.03)" : "#f9f9f9", borderRadius: 10, textAlign: "center" }}>No {cat} year images</div>
                                    : (
                                        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 110 : 160}px,1fr))`, gap: isMobile ? 7 : 12 }}>
                                            {imgs.map(img => (
                                                <div key={img.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative", background: dark ? "#222" : "#f0f0f0" }}>
                                                    <img src={img.src} alt={img.label} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                                                    <div style={{ padding: "5px 8px", background: dark ? "rgba(0,0,0,.75)" : "rgba(255,255,255,.92)" }}><div style={{ fontSize: 10, fontWeight: 600, color: dark ? "#fff" : "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.label}</div></div>
                                                    <button onClick={() => setGallery(g => g.filter(i => i.id !== img.id))} style={{ position: "absolute", top: 4, right: 4, background: "rgba(200,0,0,.88)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }
                            </div>
                        );
                    })}
                </div>
            )}
            {tab === "Star Players" && (
                <div>
                    <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>🌟 Star Players Management</h3>
                    <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 14 }}>Highlight top performers on the homepage</div>

                    <div style={{ ...cS, marginBottom: 18 }}>
                        <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Add New Star Player</h4>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div><label style={lS}>Name</label><input value={starPlayerForm.name} onChange={e => setStarPlayerForm(f => ({ ...f, name: e.target.value }))} placeholder="Player Name" style={iS} /></div>
                            <div>
                                <label style={lS}>House</label>
                                <select value={starPlayerForm.house} onChange={e => setStarPlayerForm(f => ({ ...f, house: e.target.value }))} style={iS}>
                                    <option value="">Select House</option>
                                    {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                                </select>
                            </div>
                            <div><label style={lS}>Department</label><input value={starPlayerForm.dept} onChange={e => setStarPlayerForm(f => ({ ...f, dept: e.target.value }))} placeholder="e.g. CSE" style={iS} /></div>
                            <div><label style={lS}>Year</label><input value={starPlayerForm.year} onChange={e => setStarPlayerForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. III" style={iS} /></div>
                            <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><label style={lS}>Game / Event (for which they are a star)</label><input value={starPlayerForm.game} onChange={e => setStarPlayerForm(f => ({ ...f, game: e.target.value }))} placeholder="e.g. Football / 100m Dash" style={iS} /></div>
                        </div>

                        <label style={lS}>Player Photo</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <ImgUploadBtn img={starPlayerForm.img} onUpload={d => setStarPlayerForm({ ...starPlayerForm, img: d })} dark={dark} />
                            <div style={{ fontSize: 11, color: dark ? "#888" : "#999" }}>Square image recommended (1:1)</div>
                        </div>

                        <button
                            onClick={() => {
                                if (!starPlayerForm.name || !starPlayerForm.house || !starPlayerForm.img) return alert("Name, House, and Image are required!");
                                setStarPlayers([...starPlayers, { ...starPlayerForm, id: Date.now() }]);
                                setStarPlayerForm({ name: "", dept: "", year: "", game: "", house: "", img: null });
                            }}
                            style={{ background: "linear-gradient(135deg,#D4AF37,#B8860B)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", marginTop: 10 }}
                        >
                            ⭐ Add Star Player
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                        {starPlayers.map((p, idx) => (
                            <div key={p.id || idx} style={{ ...cS, padding: 16 }}>
                                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                    {p.img ? <img src={p.img} alt={p.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid #D4AF37` }} /> : <div style={{ width: 64, height: 64, borderRadius: "50%", background: dark ? "#333" : "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: "#D4AF37", textTransform: "uppercase", marginBottom: 2 }}>{p.house}</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: dark ? "#fff" : "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: dark ? "#aaa" : "#666" }}>{p.dept} - {p.year}</div>
                                        <div style={{ fontSize: 11, color: dark ? "#aaa" : "#666", marginTop: 2 }}>🏆 {p.game}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${dark ? "#333" : "#f0f0f0"}`, paddingTop: 14 }}>
                                    <button onClick={() => setConfirmDelete({ message: `Are you sure you want to remove ${p.name}?`, onConfirm: () => setStarPlayers(starPlayers.filter(x => x.id !== p.id)) })} style={{ flex: 1, background: "#cc000018", color: "#c00", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑 Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {starPlayers.length === 0 && <div style={{ padding: 20, color: dark ? "#666" : "#aaa", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No Star Players added yet.</div>}
                </div>
            )}
            {tab === "Houses" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                        <div>
                            <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>🚩 House Management</h3>
                            <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>{houses.length} houses registered</div>
                        </div>
                        <button onClick={() => setHouses([...houses, { id: Date.now(), name: "NEW HOUSE", color: "#666666", points: 0 }])} style={{ background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>➕ Add House</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(400px, 1fr))", gap: 20 }}>
                        {houses.map(h => (
                            <div key={h.id} style={{ ...cS, borderTop: `6px solid ${h.color}`, padding: isMobile ? 14 : 20, display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${dark ? "#333" : "#f0f0f0"}` }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                                        <input type="color" value={h.color || "#000000"} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, color: e.target.value } : x))} style={{ width: 32, height: 32, padding: 0, border: "none", borderRadius: 4, cursor: "pointer", background: "none" }} title="Change House Color" />
                                        <input value={h.name} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, name: e.target.value } : x))} placeholder="House Name" style={{ ...iS, margin: 0, padding: "6px 10px", fontSize: 18, fontWeight: 900, color: h.color, border: `1px dashed ${dark ? "#444" : "#ccc"}`, background: "transparent", maxWidth: 160 }} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 10 }}>
                                        <div style={{ background: `${h.color}15`, color: h.color, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{h.points || 0} PTS</div>
                                        <button onClick={() => setConfirmDelete({ message: `Are you sure you want to delete ${h.name} House?`, onConfirm: () => setHouses(houses.filter(x => x.id !== h.id)) })} style={{ background: "transparent", border: "none", color: "#c00", cursor: "pointer", fontSize: 18, padding: "4px" }} title="Remove House">🗑</button>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, flex: 1 }}>
                                    {["staffCaptainMale", "staffCaptainFemale", "boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls"].map(role => {
                                        const isStaff = role.startsWith("staffCaptain");
                                        const isMale = role.toLowerCase().includes("boys") || role.toLowerCase().includes("male");
                                        const roleIcon = isStaff ? (isMale ? "🎓♂" : "🎓♀") : (isMale ? "♂" : "♀");
                                        const roleColor = isStaff ? (isMale ? "#1E3A8A" : "#8B0000") : (isMale ? "#1E90FF" : "#FF69B4");
                                        const roleLabel = isStaff ? (isMale ? "Staff Captain (M)" : "Staff Captain (F)") : role.replace(/([A-Z])/g, ' $1').trim().replace(/Boys|Girls/gi, "");

                                        return (
                                            <div key={role} style={{ background: dark ? "rgba(255,255,255,.02)" : "#fafafa", padding: 12, borderRadius: 10, border: `1px solid ${dark ? "#333" : "#f0f0f0"}`, display: "flex", flexDirection: "column", position: "relative" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span style={{ fontSize: 12, color: roleColor, fontWeight: 900 }}>{roleIcon}</span>
                                                        <div style={{ fontSize: 9, fontWeight: 800, color: dark ? "#888" : "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>{roleLabel}</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                                                    <ImgUploadBtn
                                                        img={h[role]?.img}
                                                        onUpload={d => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], img: d } } : x))}
                                                        size={44}
                                                        dark={dark}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <input value={h[role]?.name || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], name: e.target.value } } : x))} placeholder="Name" style={{ ...iS, margin: 0, padding: "6px 8px", fontSize: 13, fontWeight: 800, border: `1px dashed ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#fff" : "#222", width: "100%" }} />
                                                    </div>
                                                </div>

                                                <>
                                                    {isStaff ? (
                                                        <div style={{ marginBottom: 8 }}>
                                                            <input value={h[role]?.designation || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], designation: e.target.value } } : x))} placeholder="Designation (e.g., Asst. Professor CSE)" style={{ ...iS, margin: 0, padding: "5px 8px", fontSize: 10, border: `1px solid ${dark ? "#333" : "#eee"}` }} />
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                                                            <input value={h[role]?.year || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], year: e.target.value } } : x))} placeholder="Year (e.g., III)" style={{ ...iS, margin: 0, padding: "5px 8px", fontSize: 10, border: `1px solid ${dark ? "#333" : "#eee"}` }} />
                                                            <input value={h[role]?.dept || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], dept: e.target.value } } : x))} placeholder="Dept (e.g., CSE)" style={{ ...iS, margin: 0, padding: "5px 8px", fontSize: 10, border: `1px solid ${dark ? "#333" : "#eee"}` }} />
                                                        </div>
                                                    )}
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                                                        <input value={h[role]?.email || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], email: e.target.value } } : x))} placeholder="Email" style={{ ...iS, margin: 0, padding: "5px 8px", fontSize: 10, border: `1px solid ${dark ? "#333" : "#eee"}` }} />
                                                        <input value={h[role]?.password || ""} onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, [role]: { ...x[role], password: e.target.value } } : x))} placeholder="PW" style={{ ...iS, margin: 0, padding: "5px 8px", fontSize: 10, border: `1px solid ${dark ? "#333" : "#eee"}` }} />
                                                    </div>
                                                    <div style={{ width: "100%", marginTop: 10 }}>
                                                        <button onClick={() => sendCaptainEmail(h, role, role.replace(/([A-Z])/g, ' $1').trim())} disabled={!h[role]?.email || !h[role]?.password} style={{ width: "100%", padding: "6px 0", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: (!h[role]?.email || !h[role]?.password) ? "not-allowed" : "pointer", border: `1px solid ${dark ? "#444" : "#ddd"}`, background: emailStatus[`${h.id}-${role}`] === "sent" ? "#228B22" : emailStatus[`${h.id}-${role}`]?.startsWith("error") ? "#c00" : "transparent", color: emailStatus[`${h.id}-${role}`] === "sent" ? "#fff" : dark ? "#ccc" : "#666" }}>
                                                            {emailStatus[`${h.id}-${role}`] === "sending" ? "⏳ Sending..." : emailStatus[`${h.id}-${role}`] === "sent" ? "✅ Sent!" : emailStatus[`${h.id}-${role}`]?.startsWith("error") ? "❌ Failed" : "📧 Send Link"}
                                                        </button>
                                                        {emailStatus[`${h.id}-${role}`]?.startsWith("error:") && <div style={{ fontSize: 9, color: "#ff4444", marginTop: 4, textAlign: "center" }}>{emailStatus[`${h.id}-${role}`].replace("error:", "")}</div>}
                                                    </div>
                                                </>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* WhatsApp Group Links */}
                                <div style={{ marginTop: 14, borderTop: `1px solid ${dark ? "#333" : "#f0f0f0"}`, paddingTop: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: dark ? "#aaa" : "#666", marginBottom: 10 }}>📱 WhatsApp Group Links</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <label style={{ ...lS, marginBottom: 4, color: "#1E90FF" }}>♂ Men's Group</label>
                                            <input
                                                value={h.whatsappLinkMen || ""}
                                                onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, whatsappLinkMen: e.target.value } : x))}
                                                placeholder="https://chat.whatsapp.com/..."
                                                style={{ ...iS, marginBottom: 0 }}
                                            />
                                            {h.whatsappLinkMen && <div style={{ fontSize: 10, color: "#25D366", marginTop: 3, fontWeight: 600 }}>✅ Men's link set</div>}
                                        </div>
                                        <div>
                                            <label style={{ ...lS, marginBottom: 4, color: "#FF69B4" }}>♀ Women's Group</label>
                                            <input
                                                value={h.whatsappLinkWomen || ""}
                                                onChange={e => setHouses(hs => hs.map(x => x.id === h.id ? { ...x, whatsappLinkWomen: e.target.value } : x))}
                                                placeholder="https://chat.whatsapp.com/..."
                                                style={{ ...iS, marginBottom: 0 }}
                                            />
                                            {h.whatsappLinkWomen && <div style={{ fontSize: 10, color: "#25D366", marginTop: 3, fontWeight: 600 }}>✅ Women's link set</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {
                tab === "Authorities" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div><h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>👔 Sports Officials</h3><div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>PDs, Referees, Coordinators</div></div>
                            <button onClick={() => { setAuthForm(EMPTY_AUTH); setAuthModal(true); }} style={{ background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>➕ Add Official</button>
                        </div>
                        {authorities.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#888", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No officials added yet.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                                {authorities.sort((a, b) => a.priority - b.priority).map((auth, idx) => (
                                    <div key={idx} style={{ ...cS, padding: 16 }}>
                                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                            {auth.img ? <img src={auth.img} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${dark ? "#444" : "#ddd"}` }} /> : <div style={{ width: 56, height: 56, borderRadius: "50%", background: dark ? "#333" : "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 10, fontWeight: 800, color: "#1E3A8A", textTransform: "uppercase", marginBottom: 2 }}>{auth.role}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: dark ? "#fff" : "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.name}</div>
                                                <div style={{ fontSize: 11, color: dark ? "#aaa" : "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.designation}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${dark ? "#333" : "#f0f0f0"}`, paddingTop: 14 }}>
                                            <button onClick={() => { setAuthForm(auth); setAuthModal(true); }} style={{ flex: 1, background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✏️ Edit</button>
                                            <button onClick={() => setConfirmDelete({ message: `Are you sure you want to remove ${auth.name}?`, onConfirm: () => setAuthorities(authorities.filter((_, i) => i !== idx)) })} style={{ flex: 1, background: "#cc000018", color: "#c00", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑 Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {
                tab === "Management" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div><h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>🏛️ Management</h3><div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>Principal, Directors, Chairmen</div></div>
                            <button onClick={() => { setManagementForm({ ...EMPTY_AUTH, role: "Principal", priority: 1 }); setManagementModal(true); }} style={{ background: "linear-gradient(135deg,#D2691E,#8B4513)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>➕ Add Management</button>
                        </div>
                        {management?.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#888", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No management added yet.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                                {[...(management || [])].sort((a, b) => a.priority - b.priority).map((auth, idx) => (
                                    <div key={idx} style={{ ...cS, padding: 16 }}>
                                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                            {auth.img ? <img src={auth.img} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${dark ? "#444" : "#ddd"}` }} /> : <div style={{ width: 56, height: 56, borderRadius: "50%", background: dark ? "#333" : "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 10, fontWeight: 800, color: "#D2691E", textTransform: "uppercase", marginBottom: 2 }}>{auth.role}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: dark ? "#fff" : "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.name}</div>
                                                <div style={{ fontSize: 11, color: dark ? "#aaa" : "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.designation}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${dark ? "#333" : "#f0f0f0"}`, paddingTop: 14 }}>
                                            <button onClick={() => { setManagementForm(auth); setManagementModal(true); }} style={{ flex: 1, background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✏️ Edit</button>
                                            <button onClick={() => setConfirmDelete({ message: `Are you sure you want to remove ${auth.name}?`, onConfirm: () => setManagement(management.filter((_, i) => i !== idx)) })} style={{ flex: 1, background: "#cc000018", color: "#c00", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑 Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {
                tab === "Committee" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div><h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>🤝 Student Committee</h3><div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>Sports Secretaries, Captains, Coordinators</div></div>
                            <button onClick={() => { setCommitteeForm({ ...EMPTY_AUTH, role: "Sports Secretary", priority: 1 }); setCommitteeModal(true); }} style={{ background: "linear-gradient(135deg,#6A5ACD,#483D8B)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>➕ Add Member</button>
                        </div>
                        {studentCommittee?.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#888", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No committee members added yet.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                                {[...(studentCommittee || [])].sort((a, b) => a.priority - b.priority).map((auth, idx) => (
                                    <div key={idx} style={{ ...cS, padding: 16 }}>
                                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                                            {auth.img ? <img src={auth.img} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${dark ? "#444" : "#ddd"}` }} /> : <div style={{ width: 56, height: 56, borderRadius: "50%", background: dark ? "#333" : "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 10, fontWeight: 800, color: "#6A5ACD", textTransform: "uppercase", marginBottom: 2 }}>{auth.role}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: dark ? "#fff" : "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.name}</div>
                                                <div style={{ fontSize: 11, color: dark ? "#aaa" : "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.designation}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${dark ? "#333" : "#f0f0f0"}`, paddingTop: 14 }}>
                                            <button onClick={() => { setCommitteeForm(auth); setCommitteeModal(true); }} style={{ flex: 1, background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✏️ Edit</button>
                                            <button onClick={() => setConfirmDelete({ message: `Are you sure you want to remove ${auth.name}?`, onConfirm: () => setStudentCommittee(studentCommittee.filter((_, i) => i !== idx)) })} style={{ flex: 1, background: "#cc000018", color: "#c00", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑 Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {
                tab === "Games" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>⚽ Event Management</h3>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>Schedule and organize sports events</div>
                            </div>
                            <button onClick={() => { setGameForm(emptyGame); setGameModal(true); }} style={{ background: "linear-gradient(135deg,#2E8B57,#3CB371)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>➕ Create Event</button>
                        </div>
                        {adminGames.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#aaa", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No events scheduled.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                                {adminGames.map(g => (
                                    <div key={g.id} style={{ ...cS, padding: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                            <div style={{ fontWeight: 800, fontSize: 16, color: dark ? "#eee" : "#222" }}>{g.name}</div>
                                            <div style={{ fontSize: 10, background: g.type === "game" ? "#8B0000" : "#4B0082", color: "#fff", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>{g.type === "game" ? "Team Game" : "Athletic Event"}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 4 }}>👥 <strong style={{ color: dark ? "#ccc" : "#444" }}>{g.gender}</strong> • {g.maxPerTeam ? `${g.maxPerTeam} ${g.type === "game" ? "Players/Team" : "Entries/House"}` : 'Unlimited'}</div>
                                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 4 }}>🕒 {g.date} @ {g.time}</div>
                                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>📍 <span style={{ background: dark ? "#333" : "#eee", padding: "2px 6px", borderRadius: 4, color: dark ? "#ccc" : "#444" }}>{g.venue}</span></div>
                                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 12 }}>👔 Official: <strong style={{ color: dark ? "#ccc" : "#444" }}>{g.official || "Unassigned"}</strong></div>
                                        <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${dark ? "#333" : "#eee"}`, paddingTop: 12 }}>
                                            <button onClick={() => { setGameForm(g); setGameModal(true); }} style={{ flex: 1, background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Edit</button>
                                            <button onClick={() => setConfirmDelete({ message: `Are you sure you want to delete the event: ${g.name}?`, onConfirm: () => setGames(games.filter(x => x.id !== g.id)) })} style={{ flex: 1, background: "#cc000018", color: "#c00", border: "none", borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🗑 Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
            {
                tab === "Registrations" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div><h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>📝 Registrations</h3><div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>{registrations.length} total entries</div></div>
                        </div>
                        {registrations.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#aaa", textAlign: "center", background: dark ? "rgba(255,255,255,.02)" : "#f9f9f9", borderRadius: 12, border: `1px solid ${dark ? "#333" : "#eee"}`, fontSize: 13 }}>No registrations found.</div> : (
                            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}` }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                        {["Name", "Reg No", "House", "Game", "Athletic", "Approve"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {registrations.slice(0, 100).map((r, i) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                                <td style={{ padding: "8px 12px", fontWeight: 700, color: dark ? "#fff" : "#222" }}>{r.name}</td>
                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{r.regNo}</td>
                                                <td style={{ padding: "8px 12px" }}><span style={{ color: dark ? "#ccc" : "#333", fontWeight: 600 }}>{r.house}</span></td>
                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{editReg === r.regNo ? <select value={editRegForm.game} onChange={e => setEditRegForm({ ...editRegForm, game: e.target.value })} style={{ ...iS, marginBottom: 0, padding: 4 }}><option value="">None</option>{sportGamesList.map(g => <option key={g} value={g}>{g}</option>)}</select> : (r.game || "—")}</td>
                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{editReg === r.regNo ? <select value={editRegForm.athletic} onChange={e => setEditRegForm({ ...editRegForm, athletic: e.target.value })} style={{ ...iS, marginBottom: 0, padding: 4 }}><option value="">None</option>{athleticsList.map(a => <option key={a} value={a}>{a}</option>)}</select> : (r.athletic || "—")}</td>
                                                <td style={{ padding: "8px 12px" }}>
                                                    {editReg === r.regNo ? <button onClick={() => { setRegistrations(rs => rs.map(x => x.regNo === r.regNo ? { ...x, game: editRegForm.game, athletic: editRegForm.athletic } : x)); setEditReg(null); }} style={{ background: "#2E8B57", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Save</button> : <button onClick={() => { setEditRegForm({ game: r.game || "", athletic: r.athletic || "" }); setEditReg(r.regNo); }} style={{ background: dark ? "#444" : "#ddd", color: dark ? "#fff" : "#222", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Edit</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {registrations.length > 100 && <div style={{ textAlign: "center", padding: 12, color: "#888", fontSize: 12 }}>Showing first 100 entries. Export for full list.</div>}
                            </div>
                        )}
                    </div>
                )
            }

            {
                tab === "Winners" && (
                    <div>
                        <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>🏆 Result Logging</h3>
                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 20 }}>
                            Team Games: 1st (7), 2nd (5), 3rd (3) | Athletic: 1st (3), 2nd (2), 3rd (1)
                        </div>

                        <div style={{ ...cS, marginBottom: 20 }}>
                            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Log Event Outcome</h4>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                <div>
                                    <label style={lS}>Event Type</label>
                                    <select value={winner.eventType} onChange={e => setWinner({ ...winner, eventType: e.target.value, eventName: "" })} style={iS}>
                                        <option value="game">Team Game</option>
                                        <option value="athletic">Athletic Event</option>
                                        <option value="custom">Other / Custom</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={lS}>Event Name</label>
                                    {winner.eventType === "custom" ? (
                                        <input value={winner.eventName} onChange={e => setWinner({ ...winner, eventName: e.target.value })} placeholder="e.g. Tug of War" style={iS} />
                                    ) : (
                                        <select value={winner.eventName} onChange={e => setWinner({ ...winner, eventName: e.target.value })} style={iS}>
                                            <option value="">-- Select Event --</option>
                                            {(winner.eventType === "game" ? sportGamesList : athleticsList).map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {["first", "second", "third"].map((place, i) => {
                                const ptsLabel = winner.eventType === "game" ? (i === 0 ? 7 : i === 1 ? 5 : 3) : (i === 0 ? 3 : i === 1 ? 2 : 1);
                                return (
                                    <div key={place} style={{ marginBottom: 12, border: `1px solid ${dark ? "#444" : "#eee"}`, borderRadius: 10, padding: 10, background: dark ? "rgba(255,255,255,.02)" : "#fafafa", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "120px 1fr 1fr", gap: 10, alignItems: "center" }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: i === 0 ? "#D4AF37" : i === 1 ? "#C0C0C0" : "#CD7F32", textTransform: "uppercase" }}>{i === 0 ? "🥇 1st Place" : i === 1 ? "🥈 2nd Place" : "🥉 3rd Place"} (+{ptsLabel} pts)</div>
                                        <select value={winner[place]} onChange={e => setWinner({ ...winner, [place]: e.target.value })} style={{ ...iS, marginBottom: 0, padding: 8 }}>
                                            <option value="">-- House --</option>
                                            {houses.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                                        </select>
                                        <input value={winner[`${place}Player`]} onChange={e => setWinner({ ...winner, [`${place}Player`]: e.target.value })} placeholder="Player / Captain (Optional)" style={{ ...iS, marginBottom: 0, padding: 8 }} />
                                    </div>
                                )
                            })}
                            <button onClick={() => {
                                if (!winner.eventName || !winner.first || !winner.second || !winner.third) { alert("Fill all required fields"); return; }
                                const resObj = {
                                    eventName: winner.eventName, eventType: winner.eventType, time: new Date().toLocaleString(),
                                    placements: {
                                        first: { house: winner.first, player: winner.firstPlayer },
                                        second: { house: winner.second, player: winner.secondPlayer },
                                        third: { house: winner.third, player: winner.thirdPlayer }
                                    }
                                };
                                setResults([resObj, ...results]);

                                const ptsFirst = winner.eventType === "game" ? 7 : 3;
                                const ptsSecond = winner.eventType === "game" ? 5 : 2;
                                const ptsThird = winner.eventType === "game" ? 3 : 1;

                                // Award Points
                                setHouses(hs => hs.map(h => {
                                    let add = 0;
                                    if (h.name === winner.first) add += ptsFirst;
                                    if (h.name === winner.second) add += ptsSecond;
                                    if (h.name === winner.third) add += ptsThird;
                                    return { ...h, points: Math.max(0, (h.points || 0) + add) };
                                }));

                                // Point Log
                                const d = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const logs = [];
                                if (winner.first) logs.push({ type: "win", house: winner.first, reason: `1st Place - ${winner.eventName}`, pts: ptsFirst, time: d });
                                if (winner.second) logs.push({ type: "win", house: winner.second, reason: `2nd Place - ${winner.eventName}`, pts: ptsSecond, time: d });
                                if (winner.third) logs.push({ type: "win", house: winner.third, reason: `3rd Place - ${winner.eventName}`, pts: ptsThird, time: d });
                                setPointLog([...logs, ...pointLog]);

                                setWinnerSet(true); setTimeout(() => setWinnerSet(false), 3000);
                                setWinner({ first: "", second: "", third: "", eventType: winner.eventType, eventName: "", firstPlayer: "", secondPlayer: "", thirdPlayer: "" });
                            }} style={{ background: "linear-gradient(135deg,#D4AF37,#B8860B)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontWeight: 700, fontSize: 15, width: "100%", marginTop: 10 }}>Submit Result & Award Points</button>
                            {winnerSet && <div style={{ color: "#2E8B57", fontWeight: 700, marginTop: 10, textAlign: "center", fontSize: 13 }}>✅ Saved & Points Awarded!</div>}
                        </div>

                        <div style={{ ...cS }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                                <div>
                                    <h4 style={{ color: dark ? "#ccc" : "#444", margin: 0, fontSize: 14 }}>🏆 Event Results Log</h4>
                                    <div style={{ fontSize: 11, color: dark ? "#666" : "#aaa", marginTop: 2 }}>{results.length} results recorded</div>
                                </div>
                                <button onClick={() => exportWinners(results)} style={{ background: "linear-gradient(135deg,#8B0000,#C41E3A)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>📥 Export Log as Excel</button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16, background: dark ? "rgba(255,255,255,.02)" : "#f5f5f5", padding: 12, borderRadius: 10 }}>
                                <div><label style={{ fontSize: 11, fontWeight: 700, color: dark ? "#888" : "#999" }}>Event Name</label>
                                    <select value={wfEvent} onChange={e => setWfEvent(e.target.value)} style={{ ...iS, marginBottom: 0, padding: 6, fontSize: 12 }}><option value="All">All Events</option>{[...new Set(results.map(r => r.eventName))].map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                                <div><label style={{ fontSize: 11, fontWeight: 700, color: dark ? "#888" : "#999" }}>House Filter (Any Prize)</label>
                                    <select value={wfHouse} onChange={e => setWfHouse(e.target.value)} style={{ ...iS, marginBottom: 0, padding: 6, fontSize: 12 }}><option value="All">All Houses</option>{houses.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}</select></div>
                                <div><label style={{ fontSize: 11, fontWeight: 700, color: dark ? "#888" : "#999" }}>Prize Place</label>
                                    <select value={wfPrize} onChange={e => setWfPrize(e.target.value)} style={{ ...iS, marginBottom: 0, padding: 6, fontSize: 12 }}><option value="All">All Placements</option><option value="1st">🥇 1st Place Only</option><option value="2nd">🥈 2nd Place Only</option><option value="3rd">🥉 3rd Place Only</option></select></div>
                            </div>

                            {results.length === 0 ? <div style={{ padding: 20, color: dark ? "#666" : "#aaa", textAlign: "center", fontSize: 13, background: dark ? "rgba(255,255,255,.02)" : "#fafafa", borderRadius: 10 }}>No results logged yet.</div> : (
                                <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${dark ? "#333" : "#eee"}` }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                                        <thead style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                            <tr>
                                                {["Event", "🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place", "Time"].map(h => (
                                                    <th key={h} style={{ padding: "10px 14px", fontWeight: 800, color: dark ? "#aaa" : "#555", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}`, whiteSpace: "nowrap" }}>{h}</th>
                                                ))}
                                                <th style={{ padding: "10px 14px", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.filter(r => {
                                                if (wfEvent !== "All" && r.eventName !== wfEvent) return false;
                                                if (wfHouse !== "All") {
                                                    const matchesH = r.placements?.first?.house === wfHouse || r.placements?.second?.house === wfHouse || r.placements?.third?.house === wfHouse;
                                                    if (!matchesH) return false;
                                                }
                                                if (wfPrize !== "All") {
                                                    if (wfPrize === "1st" && r.placements?.first?.house !== wfHouse && wfHouse !== "All") return false;
                                                    if (wfPrize === "2nd" && r.placements?.second?.house !== wfHouse && wfHouse !== "All") return false;
                                                    if (wfPrize === "3rd" && r.placements?.third?.house !== wfHouse && wfHouse !== "All") return false;
                                                }
                                                return true;
                                            }).map((res, i) => (
                                                <tr key={i} style={{ borderBottom: `1px solid ${dark ? "#252525" : "#f0f0f0"}`, background: i % 2 === 0 ? "transparent" : dark ? "rgba(255,255,255,.01)" : "#fafafa", opacity: 0.9 }}>
                                                    <td style={{ padding: "10px 14px", color: dark ? "#e0e0e0" : "#222", fontWeight: 700 }}><div style={{ fontSize: 13 }}>{res.eventName}</div><div style={{ fontSize: 10, color: dark ? "#666" : "#aaa", fontWeight: 600, textTransform: "uppercase" }}>{res.eventType}</div></td>
                                                    <td style={{ padding: "10px 14px" }}><div style={{ color: "#D4AF37", fontWeight: 800 }}>{res.placements?.first?.house}</div><div style={{ fontSize: 10, color: dark ? "#888" : "#999" }}>{res.placements?.first?.player}</div></td>
                                                    <td style={{ padding: "10px 14px" }}><div style={{ color: "#C0C0C0", fontWeight: 800 }}>{res.placements?.second?.house}</div><div style={{ fontSize: 10, color: dark ? "#888" : "#999" }}>{res.placements?.second?.player}</div></td>
                                                    <td style={{ padding: "10px 14px" }}><div style={{ color: "#CD7F32", fontWeight: 800 }}>{res.placements?.third?.house}</div><div style={{ fontSize: 10, color: dark ? "#888" : "#999" }}>{res.placements?.third?.player}</div></td>
                                                    <td style={{ padding: "10px 14px", fontSize: 11, color: dark ? "#666" : "#999" }}>{res.time}</td>
                                                    <td style={{ padding: "10px 14px" }}><button onClick={() => { if (window.confirm("Remove this result? Points will NOT be automatically deducted. You must manually deduct them via the Points tab.")) setResults(results.filter((_, idx) => idx !== i)); }} style={{ background: "transparent", border: "none", color: "#c00", cursor: "pointer", fontSize: 16 }}>✕</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {
                tab === "Points" && (
                    <div>
                        <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: isMobile ? 15 : 18 }}>⭐ Points Center</h3>
                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 20 }}>Manually add or dock points for penalties, cheers, etc.</div>

                        <div style={{ ...cS, marginBottom: 20 }}>
                            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Manual Adjustment</h4>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 100px 1fr", gap: 10, marginBottom: 10 }}>
                                <select value={manualPts.house} onChange={e => setManualPts({ ...manualPts, house: e.target.value })} style={iS}><option value="">Select House</option>{houses.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}</select>
                                <input value={manualPts.pts} onChange={e => setManualPts({ ...manualPts, pts: e.target.value })} placeholder="Pts (+/-)" type="number" style={{ ...iS, textAlign: "center" }} />
                                <input value={manualPts.reason} onChange={e => setManualPts({ ...manualPts, reason: e.target.value })} placeholder="Reason (e.g. Penalty)" style={iS} />
                            </div>
                            <button onClick={() => {
                                if (!manualPts.house || !manualPts.pts) { alert("House and Points required"); return; }
                                const p = parseInt(manualPts.pts);
                                setHouses(hs => hs.map(h => h.name === manualPts.house ? { ...h, points: Math.max(0, (h.points || 0) + p) } : h));

                                const d = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                setPointLog([{ type: p > 0 ? "bonus" : "penalty", house: manualPts.house, reason: manualPts.reason || "Manual Adjustment", pts: p, time: d }, ...pointLog]);

                                setPtMsg(`✅ ${p > 0 ? 'Added' : 'Deducted'} ${Math.abs(p)} pts to ${manualPts.house}`);
                                setTimeout(() => setPtMsg(""), 3000);
                                setManualPts({ house: houses[0]?.name || "", pts: "", reason: "" });
                            }} style={{ background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontWeight: 700, fontSize: 15, width: "100%" }}>Apply Points</button>
                            {ptMsg && <div style={{ color: "#2E8B57", fontWeight: 700, marginTop: 10, textAlign: "center", fontSize: 13 }}>{ptMsg}</div>}
                        </div>

                        <div style={cS}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: 0, fontSize: 14 }}>Log</h4>
                                {pointLog.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Clear all ${pointLog.length} log entries from the database? House point totals will NOT change. This only removes the history.`)) {
                                                setPointLog([]);
                                            }
                                        }}
                                        style={{ background: "transparent", border: "1px solid #c00", color: "#c00", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                                    >🗑 Clear Log</button>
                                )}
                            </div>
                            {pointLog.length === 0 ? <div style={{ fontSize: 12, color: dark ? "#666" : "#aaa" }}>No points awarded yet.</div> : (
                                <div style={{ maxHeight: 300, overflowY: "auto", background: dark ? "rgba(255,255,255,.02)" : "#fafafa", borderRadius: 10, padding: 12, border: `1px solid ${dark ? "#333" : "#eee"}` }}>
                                    {pointLog.map((log, i) => (
                                        <div key={i} style={{ fontSize: 13, color: dark ? "#ccc" : "#333", padding: "8px 0", borderBottom: `1px solid ${dark ? "#333" : "#eee"}`, display: "flex", gap: 10 }}>
                                            <div style={{ fontWeight: 800, color: typeof log === "string" ? "inherit" : (log.pts > 0 ? "#2E8B57" : "#c00"), minWidth: 40 }}>{typeof log === "string" ? "" : log.pts > 0 ? `+${log.pts}` : log.pts}</div>
                                            <div style={{ flex: 1 }}>{typeof log === "string" ? log : `[${log.house}] ${log.reason}`}</div>
                                            <div style={{ fontSize: 11, color: "#888", alignSelf: "center" }}>{typeof log === "string" ? "" : log.time}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {
                tab === "Students" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: 18 }}>🎓 Master Student Database</h3>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>Central database for all students (Required for Registrations)</div>
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => setShowBulkImport(!showBulkImport)} style={{ background: showBulkImport ? (dark ? "#333" : "#eee") : "linear-gradient(135deg,#1E3A8A,#2563EB)", color: showBulkImport ? (dark ? "#fff" : "#222") : "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{showBulkImport ? "✕ Hide Import" : "📥 Bulk Import"}</button>
                            </div>
                            <input type="file" accept=".xlsx,.xls,.csv" ref={xlInputRef} style={{ display: "none" }} onChange={e => { const file = e.target.files[0]; if (file) parseFile(file); e.target.value = ""; }} />
                        </div>

                        {!xlPreview && showBulkImport && (
                            <>
                                <div
                                    onDragOver={e => { e.preventDefault(); setXlDrag(true); }}
                                    onDragLeave={() => setXlDrag(false)}
                                    onDrop={e => { e.preventDefault(); setXlDrag(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file, false); }}
                                    style={{ border: `2px dashed ${xlDrag ? "#1E3A8A" : dark ? "#444" : "#ccc"}`, borderRadius: 12, padding: isMobile ? 30 : 60, textAlign: "center", background: xlDrag ? (dark ? "rgba(30,58,138,.1)" : "#f0f8ff") : dark ? "rgba(255,255,255,.02)" : "#fafafa", transition: "all 0.2s", marginBottom: 20 }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                                    <h4 style={{ margin: "0 0 8px", color: dark ? "#ccc" : "#444" }}>Upload Student Data</h4>
                                    <div style={{ fontSize: 12, color: dark ? "#888" : "#999", marginBottom: 20 }}>Drag and drop your Excel/CSV file here. <br />Required columns: S.No, Name, Email, Reg.No, House, Year, Gender, T-Shirt Size</div>
                                    <button onClick={() => xlInputRef.current?.click()} style={{ background: "#fff", color: "#1E3A8A", border: "1px solid #1E3A8A", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Browse File</button>
                                </div>

                                <div
                                    onDragOver={e => { e.preventDefault(); setXlDrag(true); }}
                                    onDragLeave={() => setXlDrag(false)}
                                    onDrop={e => { e.preventDefault(); setXlDrag(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file, true); }}
                                    style={{ border: `2px dashed ${xlDrag ? "#8B0000" : dark ? "#444" : "#ccc"}`, borderRadius: 12, padding: isMobile ? 30 : 60, textAlign: "center", background: xlDrag ? (dark ? "rgba(139,0,0,.1)" : "#fff0f0") : dark ? "rgba(255,255,255,.02)" : "#fafafa", transition: "all 0.2s" }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>🧑‍🏫</div>
                                    <h4 style={{ margin: "0 0 8px", color: dark ? "#ccc" : "#444" }}>Upload Staff Data</h4>
                                    <div style={{ fontSize: 12, color: dark ? "#888" : "#999", marginBottom: 20 }}>Drag and drop Staff Excel/CSV file here. <br />Required columns: S.No, Name, Reg.No, Email, Gender, Department</div>
                                    <input type="file" accept=".xlsx,.xls,.csv" id="staffXlInput" style={{ display: "none" }} onChange={e => { const file = e.target.files[0]; if (file) parseFile(file, true); e.target.value = ""; }} />
                                    <button onClick={() => document.getElementById("staffXlInput").click()} style={{ background: "#fff", color: "#8B0000", border: "1px solid #8B0000", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Browse Staff File</button>
                                </div>
                            </>
                        )}

                        {xlError && <div style={{ background: "#cc000018", color: "#c00", padding: 16, borderRadius: 10, marginBottom: 20, fontSize: 13, border: "1px solid #cc000044" }}><strong>Error:</strong> {xlError} <button onClick={() => setXlError("")} style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", float: "right", fontWeight: 900 }}>✕</button></div>}

                        {xlPreview && (
                            <div style={{ ...cS, marginBottom: 20 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Previewing {xlPreview.length} Students</h4>
                                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}`, marginBottom: 16 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                        <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                            {["S.No", "Name", "Reg No", "Role", "House", "Year", "Dept", "Gender", "Size"].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {xlPreview.slice(0, 5).map((s, i) => (
                                                <tr key={i} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#888" : "#999" }}>{s.sno}</td>
                                                    <td style={{ padding: "6px 10px", fontWeight: 700, color: dark ? "#ccc" : "#333" }}>{s.name}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.regNo}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666", fontWeight: 600 }}>{s.role}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.house}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.year}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.dept}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.gender}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.shirtSize}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {xlPreview.length > 5 && <div style={{ textAlign: "center", padding: 8, color: dark ? "#888" : "#999", fontSize: 11, background: dark ? "rgba(255,255,255,.02)" : "#fafafa", borderTop: `1px solid ${dark ? "#333" : "#eee"}` }}>+ {xlPreview.length - 5} more rows</div>}
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => {
                                         // Skip EXACT duplicates (name + email + regNo all match), add all others as new entries
                                         let maxSno = studentsDB.reduce((max, s) => Math.max(max, parseInt(s.sno) || 0), 0);
                                         let addedCount = 0, skippedCount = 0;
                                         const toAdd = [];
                                         xlPreview.forEach(nr => {
                                             const isExactDuplicate = studentsDB.some(s =>
                                                 (s.name || "").trim().toLowerCase() === (nr.name || "").trim().toLowerCase() &&
                                                 (s.email || "").trim().toLowerCase() === (nr.email || "").trim().toLowerCase() &&
                                                 (s.regNo || "").trim().toLowerCase() === (nr.regNo || "").trim().toLowerCase()
                                             );
                                             if (isExactDuplicate) {
                                                 skippedCount++;
                                             } else {
                                                 maxSno++;
                                                 toAdd.push({ ...nr, sno: maxSno, shirtIssued: false });
                                                 addedCount++;
                                             }
                                         });
                                         setStudentsDB([...studentsDB, ...toAdd]);
                                         setXlPreview(null);
                                         alert(`Imported ${addedCount} student(s).${skippedCount > 0 ? ` Skipped ${skippedCount} exact duplicate(s).` : ""}`);
                                     }} style={{ flex: 1, background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Confirm & Import Database</button>
                                    <button onClick={() => setXlPreview(null)} style={{ background: "transparent", color: dark ? "#ccc" : "#555", border: `1px solid ${dark ? "#444" : "#ccc"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {studentsDB.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                    <div style={{ flex: 1, position: "relative" }}>
                                        <input
                                            value={studentSearch}
                                            onChange={e => { setStudentSearch(e.target.value); setStudentPage(1); }}
                                            placeholder="🔍 Search by Name or Reg No..."
                                            style={{ ...iS, marginBottom: 0, paddingLeft: 40 }}
                                        />
                                        <div style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</div>
                                    </div>
                                    <button
                                        onClick={() => setShowAddStudent(!showAddStudent)}
                                        style={{ background: showAddStudent ? (dark ? "#333" : "#eee") : "linear-gradient(135deg,#1E3A8A,#2563EB)", color: showAddStudent ? (dark ? "#fff" : "#222") : "#fff", border: "none", borderRadius: 8, padding: "0 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}
                                    >
                                        {showAddStudent ? "✕ Close Form" : "➕ Add Student"}
                                    </button>
                                </div>

                                {showAddStudent && (
                                    <div style={{ ...cS, marginBottom: 20, border: `2px solid ${dark ? "#1E3A8A" : "#2563EB"}` }}>
                                        <h4 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#1E3A8A", fontSize: 16 }}>➕ Add New Student</h4>
                                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                                            <div><label style={lS}>Full Name *</label><input value={addStudentForm.name} onChange={e => setAddStudentForm({ ...addStudentForm, name: e.target.value })} placeholder="Full Name" style={iS} /></div>
                                            <div><label style={lS}>Reg No *</label><input value={addStudentForm.regNo} onChange={e => setAddStudentForm({ ...addStudentForm, regNo: e.target.value })} placeholder="Registration Number" style={iS} /></div>
                                            <div><label style={lS}>Email</label><input value={addStudentForm.email} onChange={e => setAddStudentForm({ ...addStudentForm, email: e.target.value })} placeholder="Email Address" style={iS} /></div>
                                            <div>
                                                <label style={lS}>Gender</label>
                                                <select value={addStudentForm.gender} onChange={e => setAddStudentForm({ ...addStudentForm, gender: e.target.value })} style={iS}>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={lS}>House</label>
                                                <select value={addStudentForm.house} onChange={e => setAddStudentForm({ ...addStudentForm, house: e.target.value })} style={iS}>
                                                    <option value="">Select House</option>
                                                    {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                                                </select>
                                            </div>
                                            <div><label style={lS}>Year</label><input value={addStudentForm.year} onChange={e => setAddStudentForm({ ...addStudentForm, year: e.target.value })} placeholder="e.g., III" style={iS} /></div>
                                            <div><label style={lS}>Dept</label><input value={addStudentForm.dept} onChange={e => setAddStudentForm({ ...addStudentForm, dept: e.target.value })} placeholder="e.g., CSE" style={iS} /></div>
                                            <div><label style={lS}>Shirt Size</label><input value={addStudentForm.shirtSize} onChange={e => setAddStudentForm({ ...addStudentForm, shirtSize: e.target.value })} placeholder="e.g., M, L, XL" style={iS} /></div>
                                        </div>
                                        <div style={{ display: "flex", gap: 10 }}>
                                            <button
                                                onClick={() => {
                                                    if (!addStudentForm.name || !addStudentForm.regNo) return alert("Name and Reg No are required!");
                                                    if (studentsDB.some(x => x.regNo === addStudentForm.regNo)) return alert("A student with this Reg No already exists!");

                                                    let maxSno = studentsDB.reduce((max, s) => Math.max(max, parseInt(s.sno) || 0), 0);
                                                    const newStudent = {
                                                        ...addStudentForm,
                                                        sno: maxSno + 1,
                                                        shirtIssued: false,
                                                        role: "Student"
                                                    };

                                                    setStudentsDB([newStudent, ...studentsDB]);
                                                    setShowAddStudent(false);
                                                    setAddStudentForm({ name: "", regNo: "", email: "", gender: "Male", house: "", year: "", dept: "", shirtSize: "" });
                                                    alert("Student added successfully!");
                                                }}
                                                style={{ flex: 1, background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                                            >
                                                💾 Save Student
                                            </button>
                                            <button onClick={() => setShowAddStudent(false)} style={{ background: "transparent", color: dark ? "#ccc" : "#555", border: `1px solid ${dark ? "#444" : "#ccc"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}` }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                        <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                            {["S.No", "Name", "Reg No", "Email", "Gender", "House", "Year", "Dept", "Size", "Actions"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {(() => {
                                                const filtered = studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase()));
                                                const start = (studentPage - 1) * rowsPerPage;
                                                const end = start + rowsPerPage;
                                                return filtered.slice(start, end).map((s, idx) => (
                                                    <tr key={s.regNo} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                                        <td style={{ padding: "8px 12px", color: dark ? "#666" : "#aaa" }}>{s.sno || start + idx + 1}</td>
                                                        {editingRegNo === s.regNo ? (
                                                            <>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.name} onChange={e => setEditStudentForm({ ...editStudentForm, name: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }} /></td>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.regNo} onChange={e => setEditStudentForm({ ...editStudentForm, regNo: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }} /></td>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.email} onChange={e => setEditStudentForm({ ...editStudentForm, email: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }} /></td>
                                                                <td style={{ padding: "4px 8px" }}>
                                                                    <select value={editStudentForm.gender} onChange={e => setEditStudentForm({ ...editStudentForm, gender: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }}>
                                                                        <option value="Male">Male</option>
                                                                        <option value="Female">Female</option>
                                                                    </select>
                                                                </td>
                                                                <td style={{ padding: "4px 8px" }}>
                                                                    <select value={editStudentForm.house} onChange={e => setEditStudentForm({ ...editStudentForm, house: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }}>
                                                                        {houses.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.year} onChange={e => setEditStudentForm({ ...editStudentForm, year: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12, width: 60 }} /></td>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.dept} onChange={e => setEditStudentForm({ ...editStudentForm, dept: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12 }} /></td>
                                                                <td style={{ padding: "4px 8px" }}><input value={editStudentForm.shirtSize} onChange={e => setEditStudentForm({ ...editStudentForm, shirtSize: e.target.value })} style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 12, width: 40 }} /></td>
                                                                <td style={{ padding: "8px 12px" }}>
                                                                    <div style={{ display: "flex", gap: 6 }}>
                                                                        <button onClick={() => {
                                                                            setStudentsDB(db => db.map(x => x.regNo === s.regNo ? editStudentForm : x));
                                                                            setEditingRegNo(null);
                                                                        }} style={{ background: "#2E8B57", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Save</button>
                                                                        <button onClick={() => setEditingRegNo(null)} style={{ background: dark ? "#333" : "#ddd", color: dark ? "#ccc" : "#333", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Cancel</button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{ padding: "8px 12px", fontWeight: 700, color: dark ? "#fff" : "#222" }}>{s.name}</td>
                                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.regNo}</td>
                                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.email}</td>
                                                                <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.gender}</td>
                                                                <td style={{ padding: "8px 12px" }}><span style={{ color: dark ? "#ccc" : "#333", fontWeight: 600 }}>{s.house}</span></td>
                                                                <td style={{ padding: "8px 12px" }}>{s.year}</td>
                                                                <td style={{ padding: "8px 12px" }}>{s.dept}</td>
                                                                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#8B0000" }}>{s.shirtSize}</td>
                                                                <td style={{ padding: "8px 12px" }}>
                                                                    <div style={{ display: "flex", gap: 6 }}>
                                                                        <button onClick={() => {
                                                                            setEditStudentForm(s);
                                                                            setEditingRegNo(s.regNo);
                                                                        }} style={{ background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Edit</button>
                                                                        <button onClick={() => {
                                                                            if (window.confirm(`Delete ${s.name}?`)) {
                                                                                setStudentsDB(db => db.filter(x => x.regNo !== s.regNo));
                                                                            }
                                                                        }} style={{ background: "transparent", border: "none", color: "#c00", cursor: "pointer", fontSize: 10 }}>🗑</button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
                                    <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666" }}>
                                        {(() => {
                                            const filteredCount = studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase())).length;
                                            const totalPages = Math.ceil(filteredCount / rowsPerPage);
                                            return `Page ${studentPage} of ${totalPages || 1} (${filteredCount} students total)`;
                                        })()}
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <label style={{ fontSize: 11, color: dark ? "#888" : "#999" }}>Rows per page:</label>
                                        <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setStudentPage(1); }} style={{ ...iS, width: "auto", padding: "4px 8px", fontSize: 11, margin: 0 }}>
                                            {[20, 50, 100, 200, 500].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button 
                                                disabled={studentPage === 1} 
                                                onClick={() => setStudentPage(p => p - 1)}
                                                style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#f5f5f5", color: dark ? (studentPage === 1 ? "#555" : "#ccc") : (studentPage === 1 ? "#ccc" : "#333"), cursor: studentPage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}
                                            >Prev</button>
                                            <button 
                                                disabled={studentPage >= Math.ceil(studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase())).length / rowsPerPage)} 
                                                onClick={() => setStudentPage(p => p + 1)}
                                                style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#f5f5f5", color: dark ? (studentPage >= Math.ceil(studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase())).length / rowsPerPage) ? "#555" : "#ccc") : (studentPage >= Math.ceil(studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase())).length / rowsPerPage) ? "#ccc" : "#333"), cursor: studentPage >= Math.ceil(studentsDB.filter(s => (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) || (s.regNo || "").toLowerCase().includes(studentSearch.toLowerCase())).length / rowsPerPage) ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}
                                            >Next</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {studentsDB.length > 0 && (
                            <button onClick={() => { if (window.confirm(`Clear all ${studentsDB.length} students?`)) setStudentsDB([]); }} style={{ marginTop: 10, background: "transparent", border: "1px solid #c00", color: "#c00", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>🗑 Clear Database</button>
                        )}
                    </div>
                )
            }

            {
                tab === "T-Shirts" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: 18 }}>👕 T-Shirt Management</h3>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888" }}>Track T-shirt distribution across all houses and genders</div>
                            </div>
                            <button onClick={exportFilteredTShirts} style={{ background: "linear-gradient(135deg,#8B0000,#C41E3A)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>📥 Export Filtered List</button>
                        </div>

                        <div style={{ ...cS, marginBottom: 20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
                                <div>
                                    <label style={lS}>Filter by House</label>
                                    <select value={tsHouse} onChange={e => setTsHouse(e.target.value)} style={{ ...iS, marginBottom: 0 }}>
                                        <option value="All">All Houses</option>
                                        {houses.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={lS}>Filter by Gender</label>
                                    <select value={tsGender} onChange={e => setTsGender(e.target.value)} style={{ ...iS, marginBottom: 0 }}>
                                        <option value="All">All Genders</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={lS}>Filter by Status</label>
                                    <select value={tsStatus} onChange={e => setTsStatus(e.target.value)} style={{ ...iS, marginBottom: 0 }}>
                                        <option value="All">All Statuses</option>
                                        <option value="Issued">Issued ✅</option>
                                        <option value="Pending">Pending ❌</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "Total Students", value: studentsDB.length, color: "#8B0000" },
                                { label: "Total Issued", value: studentsDB.filter(s => s.shirtIssued).length, color: "#2E8B57" },
                                { label: "Pending Men", value: studentsDB.filter(s => !s.shirtIssued && (s.gender || "").toLowerCase() === "male").length, color: "#1E3A8A" },
                                { label: "Pending Women", value: studentsDB.filter(s => !s.shirtIssued && (s.gender || "").toLowerCase() === "female").length, color: "#4B0082" }
                            ].map(st => (
                                <div key={st.label} style={{ background: dark ? "rgba(255,255,255,.03)" : "#f9f9f9", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: st.color }}>{st.value}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#aaa" : "#888", textTransform: "uppercase" }}>{st.label}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}` }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 13 }}>
                                <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                    {["S.No", "Name", "Reg No", "Year", "Dept", "Gender", "House", "Size", "Status"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {studentsDB.filter(s => {
                                        if (tsHouse !== "All" && s.house !== tsHouse) return false;
                                        if (tsGender !== "All" && (s.gender || "").toLowerCase() !== tsGender.toLowerCase()) return false;
                                        if (tsStatus === "Issued" && !s.shirtIssued) return false;
                                        if (tsStatus === "Pending" && s.shirtIssued) return false;
                                        return true;
                                    }).slice(0, 100).map((s, idx) => (
                                        <tr key={s.regNo} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                            <td style={{ padding: "8px 12px", color: dark ? "#666" : "#aaa" }}>{s.sno || idx + 1}</td>
                                            <td style={{ padding: "8px 12px", fontWeight: 700, color: dark ? "#fff" : "#222" }}>{s.name}</td>
                                            <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.regNo}</td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <input
                                                    value={s.year || ""}
                                                    onChange={e => setStudentsDB(db => db.map(x => x.regNo === s.regNo ? { ...x, year: e.target.value } : x))}
                                                    style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 13, border: `1px solid ${dark ? "#333" : "#eee"}`, background: "transparent" }}
                                                />
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <input
                                                    value={s.dept || ""}
                                                    onChange={e => setStudentsDB(db => db.map(x => x.regNo === s.regNo ? { ...x, dept: e.target.value } : x))}
                                                    style={{ ...iS, margin: 0, padding: "4px 8px", fontSize: 13, border: `1px solid ${dark ? "#333" : "#eee"}`, background: "transparent" }}
                                                />
                                            </td>
                                            <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.gender}</td>
                                            <td style={{ padding: "8px 12px" }}><span style={{ color: dark ? "#ccc" : "#333", fontWeight: 600 }}>{s.house}</span></td>
                                            <td style={{ padding: "8px 12px", fontWeight: 800, color: "#8B0000" }}>{s.shirtSize}</td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <span style={{ padding: "3px 8px", borderRadius: 4, background: s.shirtIssued ? "#2E8B5722" : "#cc000011", color: s.shirtIssued ? "#2E8B57" : "#c00", fontWeight: 700, fontSize: 10 }}>
                                                    {s.shirtIssued ? "✅ ISSUED" : "❌ PENDING"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {studentsDB.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#888" }}>No students in database</div>}
                        </div>
                    </div>
                )
            }
            {
                tab === "Settings" && (
                    <div style={{ maxWidth: 600 }}>
                        <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: 18 }}>⚙️ System Settings</h3>
                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 20 }}>Configure portal URLs, email connections, and other global features</div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px", background: dark ? "rgba(255,255,255,.05)" : "#f9f9f9", borderRadius: "12px", border: `1px solid ${dark ? "#333" : "#eee"}`, marginBottom: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: dark ? "#fff" : "#333", marginBottom: 4 }}>Event Registration Status</div>
                                    <div style={{ fontSize: 11, color: dark ? "#aaa" : "#777" }}>Toggle whether students and staff can register for events.</div>
                                </div>
                                <button
                                    onClick={() => setRegistrationOpen(!registrationOpen)}
                                    style={{
                                        background: registrationOpen ? "#2E8B57" : "#c00", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, minWidth: 100
                                    }}>
                                    {registrationOpen ? "✅ OPEN" : "❌ CLOSED"}
                                </button>
                            </div>
                            <div style={{ borderTop: `1px solid ${dark ? "#333" : "#ddd"}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ddd" : "#444", marginBottom: 4 }}>Auto-Close Timer</div>
                                    <div style={{ fontSize: 11, color: dark ? "#aaa" : "#777" }}>Automatically lock registrations after this time.</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        type="datetime-local"
                                        value={registrationCloseTime || ""}
                                        onChange={e => setRegistrationCloseTime(e.target.value)}
                                        style={{ ...iS, marginBottom: 0, padding: "8px 12px" }}
                                    />
                                    {registrationCloseTime && (
                                        <button onClick={() => setRegistrationCloseTime("")} style={{ background: "#c00", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Clear</button>
                                    )}
                                </div>
                            </div>
                            <div style={{ borderTop: `1px solid ${dark ? "#333" : "#ddd"}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ddd" : "#444", marginBottom: 4 }}>Maximum Team Games</div>
                                    <div style={{ fontSize: 11, color: dark ? "#aaa" : "#777" }}>Max number of team games a participant can register for.</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        type="number" min="1" max="10"
                                        value={maxGames}
                                        onChange={e => setMaxGames(parseInt(e.target.value) || 1)}
                                        style={{ ...iS, marginBottom: 0, padding: "8px 12px", width: 70 }}
                                    />
                                </div>
                            </div>
                            <div style={{ borderTop: `1px solid ${dark ? "#333" : "#ddd"}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ddd" : "#444", marginBottom: 4 }}>Maximum Athletic Events</div>
                                    <div style={{ fontSize: 11, color: dark ? "#aaa" : "#777" }}>Max number of athletic events a participant can register for.</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        type="number" min="1" max="10"
                                        value={maxAthletics}
                                        onChange={e => setMaxAthletics(parseInt(e.target.value) || 1)}
                                        style={{ ...iS, marginBottom: 0, padding: "8px 12px", width: 70 }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ ...cS, marginBottom: 20 }}>
                            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Captain Portal Settings</h4>
                            <label style={lS}>Captain Portal URL (for emails)</label>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input value={portalUrl} onChange={e => setPortalUrl(e.target.value)} placeholder="https://..." style={{ ...iS, marginBottom: 0 }} />
                                <button onClick={() => alert("Portal URL saved!")} style={{ background: dark ? "#333" : "#eee", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Save</button>
                            </div>
                            <div style={{ fontSize: 11, color: dark ? "#666" : "#aaa", marginTop: 8 }}>This link will be sent to captains so they can access their portal.</div>
                        </div>

                        <div style={cS}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0", fontSize: 14 }}>Email Server Status</h4>
                                <button onClick={async () => {
                                    try {
                                        const res = await fetch(`${API_BASE}/api/check-email-connection`);
                                        const d = await res.json();
                                        alert(d.success ? "✅ Email connected successfully!" : `❌ Email Error: ${d.error}`);
                                    } catch (e) { alert("❌ Could not reach server. Is node running?"); }
                                }} style={{ background: "transparent", color: "#1E3A8A", border: "1px solid #1E3A8A", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Test Connection</button>
                            </div>
                            <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666" }}>SMTP connection logic is handled safely on the backend via <strong>node server.js</strong>.<br /><br />• Ensure your <strong>.env</strong> file has `SMTP_USER` and `SMTP_PASS` (App Password).<br />• If using Gmail, you MUST use an App Password, not your regular password.</div>
                        </div>
                    </div>
                )
            }

            {
                tab === "Exports" && (
                    <div style={{ maxWidth: 800 }}>
                        <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: 18 }}>📥 Data Exports</h3>
                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 20 }}>Export filtered participation lists or the full master roster</div>

                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                            <div style={cS}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Event Participation Lists</h4>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={lS}>Export By</label>
                                    <select value={exportType} onChange={e => { setExportType(e.target.value); setExportVal("All"); }} style={iS}>
                                        <option value="All">All Registered Students</option>
                                        <option value="Game">Specific Team Game</option>
                                        <option value="Athletic">Specific Athletic Event</option>
                                    </select>
                                </div>
                                {exportType === "Game" && (
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={lS}>Select Game</label>
                                        <select value={exportVal} onChange={e => setExportVal(e.target.value)} style={iS}><option value="All">All Games</option>{games.filter(g => g.type === "game").map(g => <option key={g.id} value={g.name}>{g.name}</option>)}</select>
                                    </div>
                                )}
                                {exportType === "Athletic" && (
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={lS}>Select Athletic Event</label>
                                        <select value={exportVal} onChange={e => setExportVal(e.target.value)} style={iS}><option value="All">All Athletics</option>{games.filter(g => g.type === "athletic").map(g => <option key={g.id} value={g.name}>{g.name}</option>)}</select>
                                    </div>
                                )}
                                <button onClick={exportAdminExcel} style={{ background: "linear-gradient(135deg,#8B0000,#C41E3A)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", marginTop: 8 }}>📥 Export Participation List</button>
                            </div>

                            <div style={{ ...cS, border: "2px solid #6B7280" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <h4 style={{ color: dark ? "#fff" : "#4B5563", margin: "0", fontSize: 14 }}>Staff Registrations</h4>
                                    <div style={{ background: "#4B556322", color: "#4B5563", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>Staff Only</div>
                                </div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>
                                    Export a list of all staff members who have registered for events.
                                </div>
                                <button onClick={() => {
                                    const staffRegs = registrations.filter(r => {
                                        const dbStaff = studentsDB.find(s => s.regNo === r.regNo);
                                        return dbStaff?.role === "Staff";
                                    });
                                    if (staffRegs.length === 0) return alert("No staff registrations found.");

                                    const data = staffRegs.map(r => ({
                                        "Name": r.name,
                                        "Reg No": r.regNo,
                                        "Gender": r.gender,
                                        "Role": "Staff",
                                        "Game Registration": r.game || "None",
                                        "Athletic Registration": r.athletic || "None"
                                    }));

                                    const ws = XLSX.utils.json_to_sheet(data);
                                    const wbook = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wbook, ws, "Staff Registrations");
                                    XLSX.writeFile(wbook, `Staff_Registrations_${Date.now()}.xlsx`);
                                }} style={{ background: "linear-gradient(135deg,#4B5563,#6B7280)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", marginTop: "auto" }}>📥 Export Staff Regs</button>
                            </div>
                            <div style={{ ...cS, border: "2px solid #8B0000" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <h4 style={{ color: dark ? "#fff" : "#8B0000", margin: "0", fontSize: 14 }}>T-Shirt Distribution</h4>
                                    <div style={{ background: "#8B000022", color: "#8B0000", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>T-Shirts</div>
                                </div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>
                                    Export a detailed list of all students with their T-shirt size and issuance status.
                                </div>
                                <button onClick={() => {
                                    const tShirtData = studentsDB.map(s => ({
                                        "Name": s.name,
                                        "Reg No": s.regNo,
                                        "Gender": s.gender,
                                        "House": s.house,
                                        "T-Shirt Size": s.shirtSize,
                                        "T-Shirt Status": s.shirtIssued ? "Issued" : "Pending"
                                    }));
                                    const ws = XLSX.utils.json_to_sheet(tShirtData);
                                    const wbook = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wbook, ws, "T-Shirt Distribution");
                                    XLSX.writeFile(wbook, `T-Shirt_Distribution_${Date.now()}.xlsx`);
                                }} style={{ background: "linear-gradient(135deg,#8B0000,#C41E3A)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", marginTop: "auto" }}>📥 Export T-Shirt List</button>
                            </div>
                            <div style={{ ...cS, border: "2px solid #1E3A8A" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <h4 style={{ color: dark ? "#fff" : "#1E3A8A", margin: "0", fontSize: 14 }}>Master Reference Roster</h4>
                                    <div style={{ background: "#1E3A8A22", color: "#1E3A8A", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>Full DB</div>
                                </div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>
                                    This contains EVERY student uploaded in the Students tab, along with their registration state and T-Shirt issue status.
                                </div>
                                <button onClick={exportMasterRoster} style={{ background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14, width: "100%", marginTop: "auto" }}>📥 Export Master Database</button>
                            </div>

                            <div style={{ ...cS, border: "2px solid #2E8B57", gridColumn: isMobile ? "span 1" : "span 2" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <h4 style={{ color: dark ? "#fff" : "#2E8B57", margin: "0", fontSize: 15 }}>🏁 Sports Day Final Report</h4>
                                    <div style={{ background: "#2E8B5722", color: "#2E8B57", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>COMPREHENSIVE</div>
                                </div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>
                                    This will generate a professionally formatted Word document (.docx) containing:
                                    <br />• Executive Summary & Statistics
                                    <br />• House & Captain Details
                                    <br />• Management & Sports Authority Lists
                                    <br />• Day-wise Results and Participation
                                    <br />• T-Shirt Issuance Logistics
                                </div>
                                <button onClick={exportFinalReport} style={{ background: "linear-gradient(135deg,#2E8B57,#3CB371)", color: "#fff", border: "none", borderRadius: 8, padding: "14px 20px", cursor: "pointer", fontWeight: 800, fontSize: 15, width: "100%" }}>📥 Download Final Report (.docx)</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                tab === "Config" && (
                    <div style={{ maxWidth: 800 }}>
                        <h3 style={{ color: dark ? "#fff" : "#222", marginTop: 0, marginBottom: 4, fontSize: 18 }}>🛠️ System Configuration</h3>
                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", marginBottom: 20 }}>Configure global sports app options.</div>

                        <div style={{ ...cS, marginBottom: 20, borderTop: "4px solid #8B0000" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0", fontSize: 15 }}>📅 Official Event Details</h4>
                                <div style={{ fontSize: 12, color: dark ? "#888" : "#999" }}>Displayed on home page</div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
                                <div>
                                    <label style={lS}>Sports Day Date</label>
                                    <input
                                        type="date"
                                        value={eventDate?.date || ""}
                                        onChange={e => setEventDate(p => ({ ...p, date: e.target.value }))}
                                        style={iS}
                                    />
                                </div>
                                <div>
                                    <label style={lS}>Reporting Time</label>
                                    <input
                                        type="time"
                                        value={eventDate?.time || ""}
                                        onChange={e => setEventDate(p => ({ ...p, time: e.target.value }))}
                                        style={iS}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${dark ? "#333" : "#eee"}`, paddingTop: 16, marginTop: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                    <div style={{ flex: 1, paddingRight: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ddd" : "#333", marginBottom: 4 }}>Send Official Announcement</div>
                                        <div style={{ fontSize: 11, color: dark ? "#888" : "#777", marginBottom: 10 }}>Broadcasts this schedule and unique portal links to all students, management, and authorities.</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <label style={{ background: dark ? "rgba(255,255,255,.1)" : "#f0f0f0", color: dark ? "#fff" : "#333", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-block", border: `1px solid ${dark ? "#444" : "#ccc"}` }}>
                                                📎 Attach Invitation (PDF/Image)
                                                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    setInvitationFileName(file.name);
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setInvitationFile(ev.target.result);
                                                    reader.readAsDataURL(file);
                                                }} />
                                            </label>
                                            {invitationFileName && <span style={{ fontSize: 11, color: dark ? "#aaa" : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }} title={invitationFileName}>{invitationFileName}</span>}
                                            {invitationFileName && <button onClick={() => { setInvitationFile(null); setInvitationFileName(""); }} style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 14 }}>✖</button>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={sendAnnouncementEmail}
                                        disabled={announcementStatus === "sending"}
                                        style={{
                                            background: announcementStatus === "sent" ? "#2E8B57" : announcementStatus.startsWith("error") ? "#c00" : "#8B0000",
                                            color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: announcementStatus === "sending" ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", alignSelf: "center"
                                        }}>
                                        {announcementStatus === "sending" ? "⏳ Sending..." : announcementStatus === "sent" ? "✅ Sent!" : announcementStatus.startsWith("error") ? "❌ Error" : "📢 Broadcast Email"}
                                    </button>
                                </div>
                                {announcementStatus.startsWith("error:") && <div style={{ fontSize: 11, color: "#ff4444", marginTop: 4, textAlign: "right" }}>{announcementStatus.replace("error:", "")}</div>}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${dark ? "#333" : "#eee"}`, paddingTop: 16, marginTop: 10 }}>
                                <div style={{ flex: 1, paddingRight: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#ddd" : "#333", marginBottom: 4 }}>Audit Logs</div>
                                    <div style={{ fontSize: 11, color: dark ? "#888" : "#777" }}>Download a CSV record of all Admin logins and data configuration changes.</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const token = localStorage.getItem("adminToken");
                                                const res = await fetch(`${API_BASE}/api/download-admin-logs`, {
                                                    headers: { "Authorization": `Bearer ${token}` }
                                                });
                                                if (!res.ok) {
                                                    if (res.status === 401) return alert("Session expired. Please log in again.");
                                                    throw new Error("Failed to download logs");
                                                }
                                                const blob = await res.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = url;
                                                a.download = "admin-audit-logs.csv";
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                            } catch (e) {
                                                alert("Download error: " + e.message);
                                            }
                                        }}
                                        style={{
                                            background: "#4A90E2", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap"
                                        }}>
                                        📥 Download Audit Logs (CSV)
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to clear ALL admin login and configuration change logs? This action cannot be undone.")) {
                                                try {
                                                    const token = localStorage.getItem("adminToken");
                                                    const res = await fetch(`${API_BASE}/api/clear-admin-logs`, {
                                                        method: "POST",
                                                        headers: { "Authorization": `Bearer ${token}` }
                                                    });
                                                    if (!res.ok) throw new Error("Failed to clear logs");
                                                    alert("✅ Admin logs cleared successfully!");
                                                } catch (e) {
                                                    alert("❌ Error: " + e.message);
                                                }
                                            }
                                        }}
                                        style={{
                                            background: "transparent", color: "#c00", border: "1px solid #c00", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap"
                                        }}>
                                        🗑 Clear Login Logs
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
                            <ListManager dark={dark} title="🏆 Sport Games (Men)" list={sportGamesList} setList={setSportGamesList} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🧭 Navbar Visible Items" list={nav} setList={setNav} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏆 Sport Games (Women)" list={sportGamesListWomens} setList={setSportGamesListWomens} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏆 Staff Games (Men)" list={staffGamesList || []} setList={setStaffGamesList} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏆 Staff Games (Women)" list={staffGamesListWomens || []} setList={setStaffGamesListWomens} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏃 Athletics (Men)" list={athleticsList} setList={setAthleticsList} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏃 Athletics (Women)" list={athleticsListWomens} setList={setAthleticsListWomens} closedEvents={closedEvents} setClosedEvents={setClosedEvents} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="👔 Sports Official Roles" list={authorityRoles} setList={setAuthorityRoles} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏛️ Management Roles" list={managementRoles} setList={setManagementRoles} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                        </div>
                    </div>
                )
            }

            <Sheet open={!!gameModal} onClose={() => { setGameModal(null); setGameForm(emptyGame); }}>
                <h3 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#222" }}>{gameForm.id ? "Edit Event" : "Create Event"}</h3>
                <div style={{ marginBottom: 12 }}>
                    <label style={lS}>Event Name</label>
                    <select value={gameForm.name} onChange={e => setGameForm({ ...gameForm, name: e.target.value })} style={iS}>
                        <option value="">Select an Event</option>
                        {(gameForm.type === "game" ? sportGamesList : athleticsList).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div><label style={lS}>Type</label><select value={gameForm.type} onChange={e => setGameForm({ ...gameForm, type: e.target.value, name: "" })} style={iS}><option value="game">Team Game</option><option value="athletic">Athletic</option></select></div>
                    <div><label style={lS}>Category</label><select value={gameForm.gender} onChange={e => setGameForm({ ...gameForm, gender: e.target.value })} style={iS}><option value="Boys">Boys</option><option value="Girls">Girls</option><option value="Mixed">Mixed</option></select></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div><label style={lS}>Date</label><input type="date" value={gameForm.date} onChange={e => setGameForm({ ...gameForm, date: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Time</label><input type="time" value={gameForm.time} onChange={e => setGameForm({ ...gameForm, time: e.target.value })} style={iS} /></div>
                </div>
                <div style={{ marginBottom: 12 }}><label style={lS}>{gameForm.type === "game" ? "Max Players per Team" : "Max Entries per House"}</label><input type="number" value={gameForm.maxPerTeam} onChange={e => setGameForm({ ...gameForm, maxPerTeam: Number(e.target.value) })} style={iS} placeholder="Leave blank for unlimited" min={1} /></div>
                <div style={{ marginBottom: 12 }}><label style={lS}>Venue / Location</label><input value={gameForm.venue} onChange={e => setGameForm({ ...gameForm, venue: e.target.value })} placeholder="e.g. Main Ground" style={iS} /></div>
                <div style={{ marginBottom: 20 }}><label style={lS}>Assigned Official / Conductor</label><select value={gameForm.official} onChange={e => setGameForm({ ...gameForm, official: e.target.value })} style={iS}><option value="">None / Unassigned</option>{authorities.map(a => <option key={a.name} value={a.name}>{a.name} ({a.role})</option>)}</select></div>
                <div style={{ display: "flex", gap: 10 }}><button onClick={() => { setGameModal(null); setGameForm(emptyGame); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#ccc" : "#444", fontWeight: 700, cursor: "pointer" }}>Cancel</button><button onClick={() => { if (!gameForm.name) return; if (gameForm.id) { setGames(gs => gs.map(g => g.id === gameForm.id ? gameForm : g)); } else { setGames([...games, { ...gameForm, id: Date.now() }]); } setGameModal(null); setGameForm(emptyGame); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#8B0000", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save Event</button></div>
            </Sheet>

            <Sheet open={!!authModal} onClose={() => { setAuthModal(false); setAuthForm(EMPTY_AUTH); }}>
                <h3 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#222" }}>{authForm.name ? "Edit Official" : "Add Official"}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                        <label style={lS}>Role</label>
                        <select value={authForm.role} onChange={e => setAuthForm({ ...authForm, role: e.target.value })} style={iS}>
                            {authorityRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div><label style={lS}>Name</label><input value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Designation (Optional)</label><input value={authForm.designation} onChange={e => setAuthForm({ ...authForm, designation: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Email</label><input type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Display Order (Priority)</label><input type="number" value={authForm.priority} onChange={e => setAuthForm({ ...authForm, priority: Number(e.target.value) })} style={iS} /></div>
                    <div><label style={lS}>Profile Photo (Optional)</label>
                        <ImgUploadBtn img={authForm.img} onUpload={d => setAuthForm({ ...authForm, img: d })} dark={dark} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setAuthModal(false); setAuthForm(EMPTY_AUTH); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#ccc" : "#444", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => {
                        if (!authForm.name || !authForm.role) return;
                        if (authorities.some(a => a.name === authForm.name && a !== authForm)) {
                            // Object reference check implies it's editing existing if a === authForm
                            setAuthorities(authorities.map(a => a.name === authForm.name ? authForm : a));
                        } else { setAuthorities([...authorities, authForm]); }
                        setAuthModal(false); setAuthForm(EMPTY_AUTH);
                    }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#1E3A8A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save</button>
                </div>
            </Sheet>

            <Sheet open={!!managementModal} onClose={() => { setManagementModal(false); setManagementForm(EMPTY_AUTH); }}>
                <h3 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#222" }}>{managementForm.name ? "Edit Management" : "Add Management"}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                        <label style={lS}>Role</label>
                        <select value={managementForm.role} onChange={e => setManagementForm({ ...managementForm, role: e.target.value })} style={iS}>
                            {managementRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div><label style={lS}>Name</label><input value={managementForm.name} onChange={e => setManagementForm({ ...managementForm, name: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Designation (Optional)</label><input value={managementForm.designation} onChange={e => setManagementForm({ ...managementForm, designation: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Email</label><input type="email" value={managementForm.email} onChange={e => setManagementForm({ ...managementForm, email: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Display Order (Priority)</label><input type="number" value={managementForm.priority} onChange={e => setManagementForm({ ...managementForm, priority: Number(e.target.value) })} style={iS} /></div>
                    <div><label style={lS}>Profile Photo (Optional)</label>
                        <ImgUploadBtn img={managementForm.img} onUpload={d => setManagementForm({ ...managementForm, img: d })} dark={dark} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setManagementModal(false); setManagementForm(EMPTY_AUTH); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#ccc" : "#444", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => {
                        if (!managementForm.name || !managementForm.role) return;
                        if (management.some(a => a.name === managementForm.name && a !== managementForm)) {
                            setManagement(management.map(a => a.name === managementForm.name ? managementForm : a));
                        } else { setManagement([...management, managementForm]); }
                        setManagementModal(false); setManagementForm(EMPTY_AUTH);
                    }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#D2691E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save</button>
                </div>
            </Sheet>

            <Sheet open={!!committeeModal} onClose={() => { setCommitteeModal(false); setCommitteeForm(EMPTY_AUTH); }}>
                <h3 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#222" }}>{committeeForm.name ? "Edit Member" : "Add Committee Member"}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                        <label style={lS}>Role</label>
                        <select value={committeeForm.role} onChange={e => setCommitteeForm({ ...committeeForm, role: e.target.value })} style={iS}>
                            <option value="Sports Secretary">Sports Secretary</option>
                            <option value="Joint Secretary">Joint Secretary</option>
                            <option value="Asst. Sports Secretary">Asst. Sports Secretary</option>
                            <option value="House Captain">House Captain</option>
                            <option value="House Vice Captain">House Vice Captain</option>
                            <option value="Student Coordinator">Student Coordinator</option>
                        </select>
                    </div>
                    <div><label style={lS}>Name</label><input value={committeeForm.name} onChange={e => setCommitteeForm({ ...committeeForm, name: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Designation (e.g. Year/Dept)</label><input value={committeeForm.designation} onChange={e => setCommitteeForm({ ...committeeForm, designation: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Email</label><input type="email" value={committeeForm.email} onChange={e => setCommitteeForm({ ...committeeForm, email: e.target.value })} style={iS} /></div>
                    <div><label style={lS}>Display Order (Priority)</label><input type="number" value={committeeForm.priority} onChange={e => setCommitteeForm({ ...committeeForm, priority: Number(e.target.value) })} style={iS} /></div>
                    <div><label style={lS}>Profile Photo (Optional)</label>
                        <ImgUploadBtn img={committeeForm.img} onUpload={d => setCommitteeForm({ ...committeeForm, img: d })} dark={dark} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setCommitteeModal(false); setCommitteeForm(EMPTY_AUTH); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#ccc" : "#444", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => {
                        if (!committeeForm.name || !committeeForm.role) return;
                        if (studentCommittee.some(a => a.name === committeeForm.name && a !== committeeForm)) {
                            setStudentCommittee(studentCommittee.map(a => a.name === committeeForm.name ? committeeForm : a));
                        } else { setStudentCommittee([...studentCommittee, committeeForm]); }
                        setCommitteeModal(false); setCommitteeForm(EMPTY_AUTH);
                    }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#483D8B", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save</button>
                </div>
            </Sheet>

            <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
                <h3 style={{ margin: "0 0 16px", color: dark ? "#fff" : "#222" }}>Confirm Action</h3>
                <p style={{ color: dark ? "#ccc" : "#444", marginBottom: 24, fontSize: 15 }}>{confirmDelete?.message}</p>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ccc"}`, background: "transparent", color: dark ? "#ccc" : "#444", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => { if (confirmDelete?.onConfirm) confirmDelete.onConfirm(); setConfirmDelete(null); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#c00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Yes, Remove</button>
                </div>
            </Sheet>
        </div >
    );
}

function ListManager({ title, list, setList, closedEvents, setClosedEvents, dark, isMobile, lS, iS, cS }) {
    const [val, setVal] = useState("");

    const toggleClosed = (event) => {
        if (!closedEvents || !setClosedEvents) return;
        if (closedEvents.includes(event)) {
            setClosedEvents(closedEvents.filter(e => e !== event));
        } else {
            setClosedEvents([...closedEvents, event]);
        }
    };

    return (
        <div style={cS}>
            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>{title}</h4>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && val.trim()) { setList([...list, val.trim()]); setVal(""); } }} placeholder="Add new..." style={{ ...iS, marginBottom: 0 }} />
                <button onClick={() => { if (val.trim() && !list.includes(val.trim())) { setList([...list, val.trim()]); setVal(""); } }} style={{ background: dark ? "#444" : "#ddd", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
            {list.length === 0 ? <div style={{ fontSize: 12, color: dark ? "#666" : "#aaa" }}>List is empty</div> : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {list.map(obj => {
                        const isClosed = closedEvents?.includes(obj);
                        return (
                            <div key={obj} style={{ background: dark ? "rgba(255,255,255,.05)" : "#f0f0f0", padding: "6px 12px", borderRadius: 20, fontSize: 13, color: dark ? "#ccc" : "#333", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${isClosed ? "#c00" : (dark ? "#333" : "#e5e5e5")}` }}>
                                {closedEvents && (
                                    <button onClick={() => toggleClosed(obj)} title={isClosed ? "Click to Open" : "Click to Close"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                                        {isClosed ? "🔴" : "🟢"}
                                    </button>
                                )}
                                <span style={{ textDecoration: isClosed ? "line-through" : "none", opacity: isClosed ? 0.6 : 1 }}>{obj}</span>
                                <button onClick={() => setList(list.filter(x => x !== obj))} style={{ background: "transparent", border: "none", color: "#c00", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
