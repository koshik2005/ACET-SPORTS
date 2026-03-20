import { useState, useEffect } from "react";
import "./index.css";
import { Header, Footer } from "./Layout.jsx";
import { HomePage, EventsPage, AboutPage } from "./Pages1.jsx";
import { RegistrationPage, ScoreboardPage, GalleryPage, WinnersPage, StarPlayersPage } from "./Pages2.jsx";
import { AdminPage } from "./AdminPage.jsx";
import { CaptainPortal } from "./CaptainPortal.jsx";
import { LaunchScreen } from "./LaunchScreen.jsx";
import { WelcomeScreen } from "./WelcomeScreen.jsx";
import { GuestButtonPage } from "./GuestButtonPage.jsx";

const SYNC_DEBOUNCE_MS = 1000;
const syncTimeouts = {};
const pendingSyncs = new Set();

export default function App() {
  const [active, setActive] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/admin")) return "Admin";
    if (path.includes("/captain")) return "Captain";
    if (path.includes("/button")) return "Button";
    return "Home";
  });
  const [dark, setDark] = useState(false);
  const [houses, setHouses] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [management, setManagement] = useState([]);
  const [studentCommittee, setStudentCommittee] = useState([]);
  const [games, setGames] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [pointLog, setPointLog] = useState([]);
  const [studentsDB, setStudentsDB] = useState([]);
  const [results, setResults] = useState([]);
  const [starPlayers, setStarPlayers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLaunched, setHasLaunched] = useState(() => {
    return sessionStorage.getItem("launched") === "true";
  });
  const [showCurtains, setShowCurtains] = useState(false);
  const [launchConfig, setLaunchConfig] = useState({ enabled: true, title: "Achariya Sports Day", year: "2026", released: false });

  // Configuration from API
  const [nav, setNav] = useState([]);
  const [sportGamesList, setSportGamesList] = useState([]);
  const [sportGamesListWomens, setSportGamesListWomens] = useState([]);
  const [staffGamesList, setStaffGamesList] = useState([]);
  const [staffGamesListWomens, setStaffGamesListWomens] = useState([]);
  const [athleticsList, setAthleticsList] = useState([]);
  const [athleticsListWomens, setAthleticsListWomens] = useState([]);
  const [staffAthleticsList, setStaffAthleticsList] = useState([]);
  const [staffAthleticsListWomens, setStaffAthleticsListWomens] = useState([]);
  const [authorityRoles, setAuthorityRoles] = useState([]);
  const [managementRoles, setManagementRoles] = useState([]);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationCloseTime, setRegistrationCloseTime] = useState("");
  const [eventDate, setEventDate] = useState({ date: "", time: "" });
  const [inaugurationDetails, setInaugurationDetails] = useState({ date: "", time: "", venue: "" });
  const [emptyGame, setEmptyGame] = useState({ name: "", type: "game", venue: "", official: "", status: "Upcoming", start: "", end: "", participants: "" });
  const [closedEvents, setClosedEvents] = useState([]);
  const [maxGames, setMaxGames] = useState(1);
  const [maxAthletics, setMaxAthletics] = useState(1);
  const [memorial, setMemorial] = useState({ enabled: false, list: [] });
  const [commonGamesMen, setCommonGamesMen] = useState([]);
  const [commonAthleticsMen, setCommonAthleticsMen] = useState([]);
  const [commonGamesWomen, setCommonGamesWomen] = useState([]);
  const [commonAthleticsWomen, setCommonAthleticsWomen] = useState([]);
  const [about, setAbout] = useState({ sponsors: [], credits: "" });
  const [syncing, setSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const [fetchError, setFetchError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  const refreshState = (isInitial = false) => {
    if (!isInitial) setIsFetching(true);
    const adminToken = localStorage.getItem("adminToken");
    const captainToken = localStorage.getItem("captainToken");
    const token = adminToken || captainToken;
    const fetchPath = `${token ? "/api/secure-state" : "/api/public-state"}?t=${Date.now()}`;
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    console.log(`[DEBUG] Fetching from: ${API_BASE}${fetchPath}`);

    fetch(`${API_BASE}${fetchPath}`, { headers })
      .then(res => {
        console.log(`[DEBUG] Response status: ${res.status} ${res.ok ? 'OK' : 'FAIL'}`);
        if (!res.ok) {
           if (token) {
              localStorage.removeItem("adminToken");
              localStorage.removeItem("captainToken");
              return fetch(`${API_BASE}/api/public-state?t=${Date.now()}`).then(r => r.json());
           }
           // For public state failure, try to get JSON details or text
           return res.text().then(text => {
             try {
               const errData = JSON.parse(text);
               const errMsg = errData.error || errData.message || res.statusText;
               const details = errData.details ? `: ${errData.details}` : "";
               setFetchError(`Server Error (${res.status}): ${errMsg}${details}`);
             } catch (e) {
               // Not JSON - likely a hard crash or Vercel error page
               const snippet = text.slice(0, 50).replace(/<[^>]*>?/gm, '');
               setFetchError(`Crash (${res.status}): ${snippet}...`);
             }
             throw new Error("Generic failure");
           });
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        console.log("[DEBUG] Data received keys:", Object.keys(data));
        setFetchError(null);
        const setIfReady = (key, setter) => {
          if (!pendingSyncs.has(key)) setter(data[key]);
        };

        if (data.houses) setIfReady("houses", setHouses);
        if (data.authorities) setIfReady("authorities", setAuthorities);
        if (data.management) setIfReady("management", setManagement);
        if (data.studentCommittee) setIfReady("studentCommittee", setStudentCommittee);
        if (data.games) setIfReady("games", setGames);
        if (data.gallery) setIfReady("gallery", setGallery);
        if (data.registrations) setIfReady("registrations", setRegistrations);
        if (data.pointLog) setIfReady("pointLog", setPointLog);
        if (data.studentsDB) setIfReady("studentsDB", setStudentsDB);
        if (data.adminLogs) setIfReady("adminLogs", setAdminLogs);
        if (data.results) setIfReady("results", setResults);
        if (data.memorial) setIfReady("memorial", setMemorial);
        if (data.starPlayers) setIfReady("starPlayers", setStarPlayers);

        if (data.nav) setIfReady("nav", setNav);
        if (data.sportGamesList) setIfReady("sportGamesList", setSportGamesList);
        if (data.sportGamesListWomens) setIfReady("sportGamesListWomens", setSportGamesListWomens);
        if (data.staffGamesList) setIfReady("staffGamesList", setStaffGamesList);
        if (data.staffGamesListWomens) setIfReady("staffGamesListWomens", setStaffGamesListWomens);
        if (data.athleticsList) setIfReady("athleticsList", setAthleticsList);
        if (data.athleticsListWomens) setIfReady("athleticsListWomens", setAthleticsListWomens);
        if (data.staffAthleticsList) setIfReady("staffAthleticsList", setStaffAthleticsList);
        if (data.staffAthleticsListWomens) setIfReady("staffAthleticsListWomens", setStaffAthleticsListWomens);
        if (data.authorityRoles) setIfReady("authorityRoles", setAuthorityRoles);
        if (data.managementRoles) setIfReady("managementRoles", setManagementRoles);
        if (typeof data.registrationOpen === 'boolean') setIfReady("registrationOpen", setRegistrationOpen);
        if (data.registrationCloseTime) setIfReady("registrationCloseTime", setRegistrationCloseTime);
        if (data.eventDate) setIfReady("eventDate", setEventDate);
        if (data.emptyGame) setIfReady("emptyGame", setEmptyGame);
        if (data.closedEvents) setIfReady("closedEvents", setClosedEvents);
        if (data.maxGames !== undefined) setIfReady("maxGames", setMaxGames);
        if (data.maxAthletics !== undefined) setIfReady("maxAthletics", setMaxAthletics);
        if (data.launchConfig) {
          setIfReady("launchConfig", setLaunchConfig);
          if (data.launchConfig.released) {
            setShowCurtains(true);
          }
        }
        if (data.inaugurationDetails) setIfReady("inaugurationDetails", setInaugurationDetails);
        if (data.commonGamesMen) setIfReady("commonGamesMen", setCommonGamesMen);
        if (data.commonAthleticsMen) setIfReady("commonAthleticsMen", setCommonAthleticsMen);
        if (data.commonGamesWomen) setIfReady("commonGamesWomen", setCommonGamesWomen);
        if (data.commonAthleticsWomen) setIfReady("commonAthleticsWomen", setCommonAthleticsWomen);
        if (data.about) setIfReady("about", setAbout);

        if (isInitial) setLoading(false);
        if (!isInitial) setIsFetching(false);
      })
      .catch(err => {
        console.error("Failed to fetch state:", err);
        if (isInitial) setLoading(false);
        if (!isInitial) setIsFetching(false);
      });
  };

  useEffect(() => {
    refreshState(true);
  }, []);

  // Polling for Admin and Captain portals
  useEffect(() => {
    if (active === "Admin" || active === "Captain") {
      const interval = setInterval(() => {
        refreshState(false);
      }, 30000); // refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [active]);

  // High-frequency polling for Launch Screen (Chief Guest Reveal)
  useEffect(() => {
    let interval;
    if (!hasLaunched && launchConfig?.enabled && !launchConfig?.released) {
      interval = setInterval(() => {
        fetch(`${API_BASE}/api/public-state`)
          .then(res => res.json())
          .then(data => {
            if (data?.launchConfig?.released) {
              setLaunchConfig(prev => ({ ...prev, released: true }));
              setShowCurtains(true); // Automatically transition to curtains reveal
            }
          })
          .catch(() => {});
      }, 3000); // Polling every 3 seconds during launch
    }
    return () => clearInterval(interval);
  }, [hasLaunched, launchConfig?.enabled, launchConfig?.released]);

  const sync = (type, data) => {
    pendingSyncs.add(type);
    setSyncing(true);
    
    if (syncTimeouts[type]) clearTimeout(syncTimeouts[type]);

    syncTimeouts[type] = setTimeout(() => {
      const adminToken = localStorage.getItem("adminToken");
      const captainToken = localStorage.getItem("captainToken");
      const token = adminToken || captainToken;

      fetch(`${API_BASE}/api/update-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          "X-Ceremonial-Secret": "guest2026" // Always provide for ceremonial bypass compatibility
        },
        body: JSON.stringify({ type, data })
      }).then(res => {
        pendingSyncs.delete(type);
        if (pendingSyncs.size === 0) setSyncing(false);

        if (!res.ok) {
          res.json().then(data => {
            console.error(`Sync failed for ${type}: ${data.error || res.statusText}`);
          }).catch(() => {});
        }
      }).catch(err => {
        pendingSyncs.delete(type);
        if (pendingSyncs.size === 0) setSyncing(false);
        console.error(`Network error during Sync for ${type}:`, err);
      });
    }, SYNC_DEBOUNCE_MS);
  };

  const wrap = (setter, type) => (updater) => {
    setter(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      sync(type, next);
      return next;
    });
  };

  const setHousesSync = wrap(setHouses, "houses");
  const setAuthoritiesSync = wrap(setAuthorities, "authorities");
  const setManagementSync = wrap(setManagement, "management");
  const setStudentCommitteeSync = wrap(setStudentCommittee, "studentCommittee");
  const setGamesSync = wrap(setGames, "games");
  const setGallerySync = wrap(setGallery, "gallery");
  const setRegistrationsSync = wrap(setRegistrations, "registrations");
  const setPointLogSync = wrap(setPointLog, "pointLog");
  const setStudentsDBSync = wrap(setStudentsDB, "studentsDB");
  const setResultsSync = wrap(setResults, "results");
  const setStarPlayersSync = wrap(setStarPlayers, "starPlayers");
  const setAdminLogsSync = wrap(setAdminLogs, "adminLogs");
  const setNavSync = wrap(setNav, "nav");
  const setSportGamesListSync = wrap(setSportGamesList, "sportGamesList");
  const setSportGamesListWomensSync = wrap(setSportGamesListWomens, "sportGamesListWomens");
  const setStaffGamesListSync = wrap(setStaffGamesList, "staffGamesList");
  const setStaffGamesListWomensSync = wrap(setStaffGamesListWomens, "staffGamesListWomens");
  const setAthleticsListSync = wrap(setAthleticsList, "athleticsList");
  const setAthleticsListWomensSync = wrap(setAthleticsListWomens, "athleticsListWomens");
  const setStaffAthleticsListSync = wrap(setStaffAthleticsList, "staffAthleticsList");
  const setStaffAthleticsListWomensSync = wrap(setStaffAthleticsListWomens, "staffAthleticsListWomens");
  const setCommonGamesMenSync = wrap(setCommonGamesMen, "commonGamesMen");
  const setCommonAthleticsMenSync = wrap(setCommonAthleticsMen, "commonAthleticsMen");
  const setCommonGamesWomenSync = wrap(setCommonGamesWomen, "commonGamesWomen");
  const setCommonAthleticsWomenSync = wrap(setCommonAthleticsWomen, "commonAthleticsWomen");
  const setAuthorityRolesSync = wrap(setAuthorityRoles, "authorityRoles");
  const setManagementRolesSync = wrap(setManagementRoles, "managementRoles");
  const setRegistrationOpenSync = wrap(setRegistrationOpen, "registrationOpen");
  const setRegistrationCloseTimeSync = wrap(setRegistrationCloseTime, "registrationCloseTime");
  const setEventDateSync = wrap(setEventDate, "eventDate");
  const setClosedEventsSync = wrap(setClosedEvents, "closedEvents");
  const setMaxGamesSync = wrap(setMaxGames, "maxGames");
  const setMaxAthleticsSync = wrap(setMaxAthletics, "maxAthletics");
  const setLaunchConfigSync = wrap(setLaunchConfig, "launchConfig");
  const setInaugurationDetailsSync = wrap(setInaugurationDetails, "inaugurationDetails");
  const setMemorialSync = wrap(setMemorial, "memorial");
  const setAboutSync = wrap(setAbout, "about");

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#0f0f1a" : "#f4f4f8", color: dark ? "#fff" : "#8B0000", fontSize: 24, fontWeight: 800 }}>⚡ Loading Achariya Sports...</div>;

  return (
    <div style={{
      minHeight: "100vh",
      background: dark ? "#0f0f1a" : "#f4f4f8",
      color: dark ? "#fff" : "#222",
      fontFamily: "'Segoe UI', sans-serif",
      transition: "background .3s, color .3s"
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,69,0,.3); }
          50% { box-shadow: 0 0 0 12px rgba(255,69,0,0); }
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        input[type=time] { color-scheme: ${dark ? "dark" : "light"}; }
        select option { background: ${dark ? "#1a1a2e" : "#fff"}; color: ${dark ? "#fff" : "#222"}; }
      `}</style>

      <Header active={active} setActive={(tab) => {
        window.history.pushState({}, "", tab === "Home" ? "/" : `/${tab.toLowerCase()}`);
        setActive(tab);
      }} dark={dark} setDark={setDark} nav={nav.filter(n => n !== "Admin" && n !== "Captain")} games={games} />

      {syncing && (
        <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.8)", color: "#fff", padding: "6px 14px", borderRadius: 50, fontSize: 11, fontWeight: 700, zIndex: 9999, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,.2)" }}>
          <span className="sync-spinner">⏳</span> SYNCING CHANGES...
          <style>{`
            .sync-spinner { animation: rotate 1s linear infinite; display: inline-block; }
            @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      <main>
        {fetchError && (
          <div style={{
            background: "#ff4444", color: "#fff", padding: "12px 20px", textAlign: "center",
            fontSize: 14, fontWeight: 700, boxShadow: "0 4px 12px rgba(255,0,0,0.2)",
            position: "relative", zIndex: 1000, margin: "10px", borderRadius: 8
          }}>
            ⚠️ CONNECTION ISSUE: {fetchError} | Please try refreshing the page.
          </div>
        )}
        {active === "Home" && <HomePage dark={dark} houses={houses} authorities={authorities} management={management} studentCommittee={studentCommittee} games={games} gallery={gallery} eventDate={eventDate} memorial={memorial} />}
        {active === "Events" && <EventsPage dark={dark} games={games} />}
        {active === "Winners" && <WinnersPage dark={dark} results={results} houses={houses} sportGamesList={sportGamesList} sportGamesListWomens={sportGamesListWomens} athleticsList={athleticsList} athleticsListWomens={athleticsListWomens} staffGamesList={staffGamesList} staffGamesListWomens={staffGamesListWomens} staffAthleticsList={staffAthleticsList} staffAthleticsListWomens={staffAthleticsListWomens} />}
        {active === "Registration" && <RegistrationPage dark={dark} setRegistrations={setRegistrationsSync} houses={houses} sportGamesList={sportGamesList} sportGamesListWomens={sportGamesListWomens} athleticsList={athleticsList} athleticsListWomens={athleticsListWomens} staffGamesList={staffGamesList} staffGamesListWomens={staffGamesListWomens} registrationOpen={registrationOpen} registrationCloseTime={registrationCloseTime} closedEvents={closedEvents} maxGames={maxGames} maxAthletics={maxAthletics} commonGamesMen={commonGamesMen} commonAthleticsMen={commonAthleticsMen} commonGamesWomen={commonGamesWomen} commonAthleticsWomen={commonAthleticsWomen} />}
        {active === "Scoreboard" && <ScoreboardPage dark={dark} houses={houses} pointLog={pointLog} registrationOpen={registrationOpen} registrationCloseTime={registrationCloseTime} />}
        {active === "Star Players" && <StarPlayersPage dark={dark} starPlayers={starPlayers} houses={houses} />}
        {active === "Gallery" && <GalleryPage dark={dark} gallery={gallery} />}
        {active === "About" && <AboutPage dark={dark} about={about} />}
        {active === "Admin" && <AdminPage
          dark={dark}
          houses={houses} setHouses={setHousesSync}
          authorities={authorities} setAuthorities={setAuthoritiesSync}
          management={management} setManagement={setManagementSync}
          studentCommittee={studentCommittee} setStudentCommittee={setStudentCommitteeSync}
          games={games} setGames={setGamesSync}
          gallery={gallery} setGallery={setGallerySync}
          registrations={registrations} setRegistrations={setRegistrationsSync}
          pointLog={pointLog} setPointLog={setPointLogSync}
          studentsDB={studentsDB} setStudentsDB={setStudentsDBSync}
          results={results} setResults={setResultsSync}
          starPlayers={starPlayers} setStarPlayers={setStarPlayersSync}
          adminLogs={adminLogs} setAdminLogs={setAdminLogsSync}
          nav={nav} setNav={setNavSync}
          sportGamesList={sportGamesList} setSportGamesList={setSportGamesListSync}
          sportGamesListWomens={sportGamesListWomens} setSportGamesListWomens={setSportGamesListWomensSync}
          staffGamesList={staffGamesList} setStaffGamesList={setStaffGamesListSync}
          staffGamesListWomens={staffGamesListWomens} setStaffGamesListWomens={setStaffGamesListWomensSync}
          staffAthleticsList={staffAthleticsList} setStaffAthleticsList={setStaffAthleticsListSync}
          staffAthleticsListWomens={staffAthleticsListWomens} setStaffAthleticsListWomens={setStaffAthleticsListWomensSync}
           athleticsList={athleticsList} setAthleticsList={setAthleticsListSync}
          memorial={memorial} setMemorial={setMemorialSync}
          about={about} setAbout={setAboutSync}
          athleticsListWomens={athleticsListWomens} setAthleticsListWomens={setAthleticsListWomensSync}
          authorityRoles={authorityRoles} setAuthorityRoles={setAuthorityRolesSync}
          managementRoles={managementRoles} setManagementRoles={setManagementRolesSync}
          registrationOpen={registrationOpen} setRegistrationOpen={setRegistrationOpenSync}
          registrationCloseTime={registrationCloseTime} setRegistrationCloseTime={setRegistrationCloseTimeSync}
          eventDate={eventDate} setEventDate={setEventDateSync}
          emptyGame={emptyGame}
          closedEvents={closedEvents} setClosedEvents={setClosedEventsSync}
          maxGames={maxGames} setMaxGames={setMaxGamesSync}
          maxAthletics={maxAthletics} setMaxAthletics={setMaxAthleticsSync}
          launchConfig={launchConfig} setLaunchConfig={setLaunchConfigSync}
          inaugurationDetails={inaugurationDetails} setInaugurationDetails={setInaugurationDetailsSync}
          commonGamesMen={commonGamesMen} setCommonGamesMen={setCommonGamesMenSync}
          commonAthleticsMen={commonAthleticsMen} setCommonAthleticsMen={setCommonAthleticsMenSync}
          commonGamesWomen={commonGamesWomen} setCommonGamesWomen={setCommonGamesWomenSync}
          commonAthleticsWomen={commonAthleticsWomen} setCommonAthleticsWomen={setCommonAthleticsWomenSync}
        />}
        {active === "Button" && <GuestButtonPage dark={dark} launchConfig={launchConfig} onUpdateConfig={setLaunchConfigSync} syncing={syncing} />}
        {active === "Captain" && <CaptainPortal dark={dark} houses={houses} registrations={registrations} studentsDB={studentsDB} setStudentsDB={setStudentsDBSync} isFetching={isFetching} />}
      </main>

      <Footer dark={dark} nav={nav.filter(n => n !== "Admin" && n !== "Captain")} houses={houses} />
      
      {launchConfig?.enabled && !hasLaunched && active === "Home" && (
        !showCurtains ? (
          <WelcomeScreen config={launchConfig} onStart={() => setShowCurtains(true)} />
        ) : (
          <LaunchScreen config={launchConfig} onLaunch={() => {
            setHasLaunched(true);
            sessionStorage.setItem("launched", "true");
          }} />
        )
      )}
    </div>
  );
}
