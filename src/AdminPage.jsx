import { useState, useEffect, useRef } from "react";
import { useIsMobile, hi, tint, Sheet } from "./utils.jsx";
import { ImgUploadBtn } from "./ImgUploadBtn.jsx";
import { ImageCropper } from "./ImageCropper.jsx";
import { API_BASE } from "./api.js";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from "docx";
import { saveAs } from "file-saver";

const EMPTY_AUTH = { role: "Sports Official", name: "", designation: "", email: "", img: null, priority: 5 };

export function AdminPage({
    dark, houses, setHouses, authorities, setAuthorities, management = [], setManagement, games, setGames, gallery, setGallery,
    registrations, setRegistrations, pointLog, setPointLog, studentsDB, setStudentsDB, results = [], setResults,
    studentCommittee = [], setStudentCommittee,
    sportGamesList = [], setSportGamesList, athleticsList = [], setAthleticsList,
    authorityRoles = [], setAuthorityRoles, managementRoles = [], setManagementRoles,
    eventDate, setEventDate, emptyGame
}) {
    const [loggedIn, setLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [otpSent, setOtpSent] = useState(false);
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

    const TABS = ["Gallery", "Houses", "Authorities", "Management", "Committee", "Games", "Registrations", "Winners", "Points", "Students", "T-Shirts", "Settings", "Exports", "Config"];

    const parseFile = (file) => {
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
                    return {
                        sno: n["s.no"] || n.sno || n.sn || "",
                        name: n.name || n["student name"] || n["full name"] || "",
                        email: n.email || n["email id"] || n["mail"] || "",
                        regNo: n.regno || n["reg.no"] || n["register number"] || n["id"] || n.mobile || "",
                        house: n.house || n["house name"] || "",
                        year: n.year || n.class || n.batch || n.y || "",
                        dept: n.dept || n.department || n.branch || n.course || "",
                        shirtSize: n["t-shirt size"] || n["tshirt size"] || n["tshirt"] || n.size || "",
                        gender: n.gender || n.sex || n.g || n.mf || n["m/f"] || "",
                        shirtIssued: false
                    };
                }).filter(r => r.name || r.email || r.regNo);
                if (rows.length === 0) { setXlError("Could not find required columns. Ensure headers match: s.no, name, reg.no, email, year, department, house, gender, t-shirt size."); return; }
                setXlPreview(rows);
            } catch (e) { setXlError("Failed to read file: " + e.message); }
        };
        reader.readAsBinaryString(file);
    };

    const handleSendOtp = async () => {
        if (!adminEmail || !adminEmail.includes("@")) {
            setLoginError("Please enter a valid Admin Email address");
            return;
        }
        setLoginError(""); setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin-send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setOtpSent(true);
            } else {
                setLoginError(data.error || "Failed to send OTP.");
            }
        } catch (err) {
            console.error("OTP REQUEST ERROR:", err);
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

                // Fetch the secure state that includes passwords
                const secureRes = await fetch(`${API_BASE}/api/secure-state`, {
                    headers: { "Authorization": `Bearer ${data.token}` }
                });
                const secureData = await secureRes.json();

                if (secureData.houses) setHouses(secureData.houses);

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

    const exportFinalReport = async () => {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ text: "ACHARIYA SPORTS DAY FINAL REPORT", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

                    new Paragraph({ text: "1. EXECUTIVE SUMMARY", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ children: [new TextRun({ text: "Total Unique Participants: ", bold: true }), new TextRun(String([...new Set(registrations.map(r => r.regNo))].length))] }),
                    new Paragraph({ children: [new TextRun({ text: "Total Scheduled Events: ", bold: true }), new TextRun(String(games.length))] }),
                    new Paragraph({ children: [new TextRun({ text: "Total Results Recorded: ", bold: true }), new TextRun(String(results.length))] }),
                    new Paragraph({ children: [new TextRun({ text: "Total Houses: ", bold: true }), new TextRun(String(houses.length))] }),
                    new Paragraph({ children: [new TextRun({ text: "Event Schedule: ", bold: true }), new TextRun(`${eventDate.date || "Not Set"} @ ${eventDate.time || "Not Set"}`)] }),

                    new Paragraph({ text: "2. HOUSE ADMINISTRATION", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "House", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Boys Captain", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Girls Captain", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Boys Vice Captain", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Girls Vice Captain", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Staff Captain (M)", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Staff Captain (F)", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Total Points", bold: true })] }),
                                ]
                            }),
                            ...houses.map(h => new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph(h.name)] }),
                                    new TableCell({ children: [new Paragraph(h.boysCaptain?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph(h.girlsCaptain?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph(h.viceCaptainBoys?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph(h.viceCaptainGirls?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph(h.staffCaptainMale?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph(h.staffCaptainFemale?.name || "—")] }),
                                    new TableCell({ children: [new Paragraph((h.points || 0).toString())] }),
                                ]
                            }))
                        ]
                    }),

                    new Paragraph({ text: "3. OFFICIALS & MANAGEMENT", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ text: "Management", heading: HeadingLevel.HEADING_2 }),
                    ...management.map(m => new Paragraph({ text: `• ${m.name} (${m.role}) - ${m.designation || ""}`, bullet: { level: 0 } })),
                    new Paragraph({ text: "Sports Authority", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
                    ...authorities.map(a => new Paragraph({ text: `• ${a.name} (${a.role}) - ${a.designation || ""}`, bullet: { level: 0 } })),

                    new Paragraph({ text: "4. DAY-WISE SCHEDULE & RESULTS", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    ...[...new Set(games.map(g => g.date || "Unscheduled"))].sort().map(date => [
                        new Paragraph({ text: `Date: ${date}`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph({ text: "Event", bold: true })] }),
                                        new TableCell({ children: [new Paragraph({ text: "Type", bold: true })] }),
                                        new TableCell({ children: [new Paragraph({ text: "1st Place", bold: true })] }),
                                        new TableCell({ children: [new Paragraph({ text: "2nd Place", bold: true })] }),
                                        new TableCell({ children: [new Paragraph({ text: "3rd Place", bold: true })] }),
                                    ]
                                }),
                                ...games.filter(g => (g.date || "Unscheduled") === date).map(g => {
                                    const res = results.find(r => r.eventName === g.name);
                                    return new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph(g.name)] }),
                                            new TableCell({ children: [new Paragraph(g.type === "game" ? "Team Game" : "Athletic")] }),
                                            new TableCell({ children: [new Paragraph(`${res?.placements?.first?.house || "—"}${res?.placements?.first?.player ? ` (${res?.placements?.first?.player})` : ""}`)] }),
                                            new TableCell({ children: [new Paragraph(`${res?.placements?.second?.house || "—"}${res?.placements?.second?.player ? ` (${res?.placements?.second?.player})` : ""}`)] }),
                                            new TableCell({ children: [new Paragraph(`${res?.placements?.third?.house || "—"}${res?.placements?.third?.player ? ` (${res?.placements?.third?.player})` : ""}`)] }),
                                        ]
                                    });
                                })
                            ]
                        })
                    ]).flat(),

                    new Paragraph({ text: "5. OVERALL RESULTS SUMMARY", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "Event Name", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "🥇 1st Place", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "🥈 2nd Place", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "🥉 3rd Place", bold: true })] }),
                                ]
                            }),
                            ...results.map(res => new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph(res.eventName)] }),
                                    new TableCell({ children: [new Paragraph(`${res.placements?.first?.house || "—"}${res.placements?.first?.player ? ` (${res.placements?.first?.player})` : ""}`)] }),
                                    new TableCell({ children: [new Paragraph(`${res.placements?.second?.house || "—"}${res.placements?.second?.player ? ` (${res.placements?.second?.player})` : ""}`)] }),
                                    new TableCell({ children: [new Paragraph(`${res.placements?.third?.house || "—"}${res.placements?.third?.player ? ` (${res.placements?.third?.player})` : ""}`)] }),
                                ]
                            }))
                        ]
                    }),

                    new Paragraph({ text: "6. PARTICIPATION BREAKDOWN", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ text: "Student Participation by Event", heading: HeadingLevel.HEADING_2 }),
                    ...games.map(g => [
                        new Paragraph({ text: g.name, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
                        ...registrations.filter(r => (g.type === "game" ? r.game === g.name : r.athletic === g.name)).map(r => {
                            const s = studentsDB.find(st => st.regNo === r.regNo);
                            return new Paragraph({ text: `• ${r.name} (${r.regNo}) - ${s?.year || ""} ${s?.dept ? `(${s.dept})` : ""} - ${r.house} House`, bullet: { level: 0 } });
                        }),
                        registrations.filter(r => (g.type === "game" ? r.game === g.name : r.athletic === g.name)).length === 0 ? new Paragraph({ text: "No registrations for this event.", italics: true }) : null
                    ]).flat().filter(Boolean),

                    new Paragraph({ text: "7. LOGISTICS: T-SHIRT ISSUANCE", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "Student Name", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Reg No", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Year (Dept)", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "House", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Size", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Status", bold: true })] }),
                                ]
                            }),
                            ...studentsDB.map(s => new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph(s.name)] }),
                                    new TableCell({ children: [new Paragraph(s.regNo)] }),
                                    new TableCell({ children: [new Paragraph(`${s.year || ""} ${s.dept ? `(${s.dept})` : ""}`)] }),
                                    new TableCell({ children: [new Paragraph(s.house)] }),
                                    new TableCell({ children: [new Paragraph(s.shirtSize)] }),
                                    new TableCell({ children: [new Paragraph(s.shirtIssued ? "✅ Issued" : "⏳ Pending")] }),
                                ]
                            }))
                        ]
                    })
                ].filter(Boolean), // Filter out any nulls from the children array
            }]
        });

        Packer.toBlob(doc).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Achariya_Sports_Final_Report_${new Date().toISOString().split('T')[0]}.docx`;
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

    if (!loggedIn) return (
        <div style={{ maxWidth: 400, margin: isMobile ? "24px auto" : "80px auto", padding: isMobile ? "16px 14px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 48 }}>🔐</div><h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", fontSize: isMobile ? 20 : 24 }}>Admin Login</h2></div>
            <div style={cS}>
                {!otpSent ? (
                    <>
                        <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendOtp()} placeholder="Enter Admin Email" style={{ ...iS, marginBottom: 12 }} />
                        {loginError && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠ {loginError}</div>}
                        <button onClick={handleSendOtp} disabled={isVerifying} style={{ width: "100%", background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: isVerifying ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 16 }}>{isVerifying ? "Sending..." : "Send Verification Code"}</button>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 13, color: dark ? "#aaa" : "#555", marginBottom: 12, textAlign: "center" }}>Enter the 6-digit code sent to {adminEmail}</div>
                        <input type="text" value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} maxLength={6} placeholder="······" style={{ ...iS, marginBottom: 8, textAlign: "center", letterSpacing: 6, fontSize: 24, fontWeight: 800 }} />
                        {loginError && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>⚠ {loginError}</div>}
                        <button onClick={handleLogin} disabled={isVerifying || otp.length < 6} style={{ width: "100%", background: "#2E8B57", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: (isVerifying || otp.length < 6) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 16 }}>{isVerifying ? "Verifying..." : "Login"}</button>
                        <button onClick={() => { setOtpSent(false); setOtp(""); setLoginError(""); }} style={{ width: "100%", background: "transparent", color: "#1E90FF", border: "none", marginTop: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Back</button>
                    </>
                )}
            </div>
        </div>
    );

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
                            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Log</h4>
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
                                <button onClick={() => xlInputRef.current?.click()} style={{ background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Import Excel</button>
                            </div>
                            <input type="file" accept=".xlsx,.xls,.csv" ref={xlInputRef} style={{ display: "none" }} onChange={e => { const file = e.target.files[0]; if (file) parseFile(file); e.target.value = ""; }} />
                        </div>

                        {!xlPreview && studentsDB.length === 0 && (
                            <div
                                onDragOver={e => { e.preventDefault(); setXlDrag(true); }}
                                onDragLeave={() => setXlDrag(false)}
                                onDrop={e => { e.preventDefault(); setXlDrag(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file); }}
                                style={{ border: `2px dashed ${xlDrag ? "#1E3A8A" : dark ? "#444" : "#ccc"}`, borderRadius: 12, padding: isMobile ? 30 : 60, textAlign: "center", background: xlDrag ? (dark ? "rgba(30,58,138,.1)" : "#f0f8ff") : dark ? "rgba(255,255,255,.02)" : "#fafafa", transition: "all 0.2s" }}
                            >
                                <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                                <h4 style={{ margin: "0 0 8px", color: dark ? "#ccc" : "#444" }}>Upload Student Data</h4>
                                <div style={{ fontSize: 12, color: dark ? "#888" : "#999", marginBottom: 20 }}>Drag and drop your Excel/CSV file here. <br />Required columns: S.No, Name, Email, Reg.No, House, Year, Gender, T-Shirt Size</div>
                                <button onClick={() => xlInputRef.current?.click()} style={{ background: "#fff", color: "#1E3A8A", border: "1px solid #1E3A8A", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Browse File</button>
                            </div>
                        )}

                        {xlError && <div style={{ background: "#cc000018", color: "#c00", padding: 16, borderRadius: 10, marginBottom: 20, fontSize: 13, border: "1px solid #cc000044" }}><strong>Error:</strong> {xlError} <button onClick={() => setXlError("")} style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", float: "right", fontWeight: 900 }}>✕</button></div>}

                        {xlPreview && (
                            <div style={{ ...cS, marginBottom: 20 }}>
                                <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>Previewing {xlPreview.length} Students</h4>
                                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}`, marginBottom: 16 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                        <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                            {["S.No", "Name", "Reg No", "House", "Year", "Dept", "Gender", "Size"].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {xlPreview.slice(0, 5).map((s, i) => (
                                                <tr key={i} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#888" : "#999" }}>{s.sno}</td>
                                                    <td style={{ padding: "6px 10px", fontWeight: 700, color: dark ? "#ccc" : "#333" }}>{s.name}</td>
                                                    <td style={{ padding: "6px 10px", color: dark ? "#aaa" : "#666" }}>{s.regNo}</td>
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
                                        // Identify current highest S.No and map
                                        let maxSno = studentsDB.reduce((max, s) => Math.max(max, parseInt(s.sno) || 0), 0);
                                        const merged = [...studentsDB];
                                        let addedCount = 0;
                                        xlPreview.forEach(nr => {
                                            // Update existing or add new
                                            const idx = merged.findIndex(sr => sr.regNo === nr.regNo && sr.regNo);
                                            if (idx >= 0) { merged[idx] = { ...merged[idx], ...nr, sno: merged[idx].sno || nr.sno }; }
                                            else {
                                                maxSno++;
                                                merged.push({ ...nr, sno: nr.sno || maxSno, shirtIssued: false });
                                                addedCount++;
                                            }
                                        });
                                        setStudentsDB(merged);
                                        setXlPreview(null);
                                        alert(`Successfully added ${addedCount} and updated ${xlPreview.length - addedCount} students.`);
                                    }} style={{ flex: 1, background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Confirm & Import Database</button>
                                    <button onClick={() => setXlPreview(null)} style={{ background: "transparent", color: dark ? "#ccc" : "#555", border: `1px solid ${dark ? "#444" : "#ccc"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {studentsDB.length > 0 && (
                            <div>
                                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${dark ? "#333" : "#e5e5e5"}` }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                        <thead><tr style={{ background: dark ? "#1e1e2e" : "#f5f5f5" }}>
                                            {["S.No", "Name", "Reg No", "House", "Year", "Dept", "Gender", "Size", "Issued T-Shirt"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: dark ? "#ccc" : "#444", borderBottom: `1px solid ${dark ? "#333" : "#ddd"}` }}>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {studentsDB.slice(0, 100).map((s, idx) => (
                                                <tr key={s.regNo} style={{ borderBottom: `1px solid ${dark ? "#2a2a2a" : "#f0f0f0"}` }}>
                                                    <td style={{ padding: "8px 12px", color: dark ? "#666" : "#aaa" }}>{s.sno || idx + 1}</td>
                                                    <td style={{ padding: "8px 12px", fontWeight: 700, color: dark ? "#fff" : "#222" }}>{s.name}</td>
                                                    <td style={{ padding: "8px 12px", color: dark ? "#aaa" : "#555" }}>{s.regNo}</td>
                                                    <td style={{ padding: "8px 12px" }}><span style={{ color: dark ? "#ccc" : "#333", fontWeight: 600 }}>{s.house}</span></td>
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
                                                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "#8B0000" }}>{s.shirtSize}</td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        <input type="checkbox" checked={s.shirtIssued} onChange={e => {
                                                            const isChecked = e.target.checked;
                                                            setStudentsDB(db => db.map(x => x.regNo === s.regNo ? { ...x, shirtIssued: isChecked } : x));
                                                        }} style={{ cursor: "pointer", width: 16, height: 16 }} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {studentsDB.length > 100 && <div style={{ textAlign: "center", padding: 12, color: "#888", fontSize: 12 }}>Showing first 100 students. Export to Excel for full list.</div>}
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
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
                            <ListManager dark={dark} title="🏆 Sport Games (Team)" list={sportGamesList} setList={setSportGamesList} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
                            <ListManager dark={dark} title="🏃 Athletics (Individual)" list={athleticsList} setList={setAthleticsList} isMobile={isMobile} lS={lS} iS={iS} cS={cS} />
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

function ListManager({ title, list, setList, dark, isMobile, lS, iS, cS }) {
    const [val, setVal] = useState("");
    return (
        <div style={cS}>
            <h4 style={{ color: dark ? "#ccc" : "#444", margin: "0 0 12px", fontSize: 14 }}>{title}</h4>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && val.trim()) { setList([...list, val.trim()]); setVal(""); } }} placeholder="Add new..." style={{ ...iS, marginBottom: 0 }} />
                <button onClick={() => { if (val.trim() && !list.includes(val.trim())) { setList([...list, val.trim()]); setVal(""); } }} style={{ background: dark ? "#444" : "#ddd", color: dark ? "#ccc" : "#444", border: "none", borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
            {list.length === 0 ? <div style={{ fontSize: 12, color: dark ? "#666" : "#aaa" }}>List is empty</div> : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {list.map(obj => (
                        <div key={obj} style={{ background: dark ? "rgba(255,255,255,.05)" : "#f0f0f0", padding: "6px 12px", borderRadius: 20, fontSize: 13, color: dark ? "#ccc" : "#333", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${dark ? "#333" : "#e5e5e5"}` }}>
                            {obj} <button onClick={() => setList(list.filter(x => x !== obj))} style={{ background: "transparent", border: "none", color: "#c00", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
