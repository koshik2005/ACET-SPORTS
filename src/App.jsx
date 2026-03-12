import { useState, useEffect } from "react";
import "./index.css";
import { Header, Footer } from "./Layout.jsx";
import { HomePage, EventsPage } from "./Pages1.jsx";
import { RegistrationPage, ScoreboardPage, GalleryPage, WinnersPage, StarPlayersPage } from "./Pages2.jsx";
import { AdminPage } from "./AdminPage.jsx";
import { CaptainPortal } from "./CaptainPortal.jsx";
import { LaunchScreen } from "./LaunchScreen.jsx";

export default function App() {
  const [active, setActive] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/admin")) return "Admin";
    if (path.includes("/captain")) return "Captain";
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
  const [launchConfig, setLaunchConfig] = useState({ enabled: true, title: "Achariya Sports Day", year: "2026" });

  // Configuration from API
  const [nav, setNav] = useState([]);
  const [sportGamesList, setSportGamesList] = useState([]);
  const [sportGamesListWomens, setSportGamesListWomens] = useState([]);
  const [staffGamesList, setStaffGamesList] = useState([]);
  const [staffGamesListWomens, setStaffGamesListWomens] = useState([]);
  const [athleticsList, setAthleticsList] = useState([]);
  const [athleticsListWomens, setAthleticsListWomens] = useState([]);
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

  const API_BASE = import.meta.env.VITE_API_BASE || "";

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const captainToken = localStorage.getItem("captainToken");
    const token = adminToken || captainToken;
    const fetchPath = token ? "/api/secure-state" : "/api/public-state";
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    fetch(`${API_BASE}${fetchPath}`, { headers })
      .then(res => {
        if (!res.ok && token) {
          // If secure fetch fails (expired token), fallback to public
          localStorage.removeItem("adminToken");
          localStorage.removeItem("captainToken");
          return fetch(`${API_BASE}/api/public-state`).then(r => r.json());
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        if (data.houses) setHouses(data.houses);
        if (data.authorities) setAuthorities(data.authorities);
        if (data.management) setManagement(data.management);
        if (data.studentCommittee) setStudentCommittee(data.studentCommittee);
        if (data.games) setGames(data.games);
        if (data.gallery) setGallery(data.gallery);
        if (data.registrations) setRegistrations(data.registrations);
        if (data.pointLog) setPointLog(data.pointLog);
        if (data.studentsDB) setStudentsDB(data.studentsDB);
        if (data.adminLogs) setAdminLogs(data.adminLogs);
        if (data.results) setResults(data.results);
        if (data.starPlayers) setStarPlayers(data.starPlayers);

        // Set config
        if (data.nav) setNav(data.nav);
        if (data.sportGamesList) setSportGamesList(data.sportGamesList);
        if (data.sportGamesListWomens) setSportGamesListWomens(data.sportGamesListWomens);
        if (data.staffGamesList) setStaffGamesList(data.staffGamesList);
        if (data.staffGamesListWomens) setStaffGamesListWomens(data.staffGamesListWomens);
        if (data.athleticsList) setAthleticsList(data.athleticsList);
        if (data.athleticsListWomens) setAthleticsListWomens(data.athleticsListWomens);
        if (data.authorityRoles) setAuthorityRoles(data.authorityRoles);
        if (data.managementRoles) setManagementRoles(data.managementRoles);
        if (typeof data.registrationOpen === 'boolean') setRegistrationOpen(data.registrationOpen);
        if (data.registrationCloseTime) setRegistrationCloseTime(data.registrationCloseTime);
        if (data.eventDate) setEventDate(data.eventDate);
        if (data.emptyGame) setEmptyGame(data.emptyGame);
        if (data.closedEvents) setClosedEvents(data.closedEvents);
        if (data.maxGames !== undefined) setMaxGames(data.maxGames);
        if (data.maxAthletics !== undefined) setMaxAthletics(data.maxAthletics);
        if (data.launchConfig) setLaunchConfig(data.launchConfig);
        if (data.inaugurationDetails) setInaugurationDetails(data.inaugurationDetails);

        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch state:", err);
        setLoading(false);
      });
  }, []);

  const sync = (type, data) => {
    const adminToken = localStorage.getItem("adminToken");
    const captainToken = localStorage.getItem("captainToken");
    const token = adminToken || captainToken;

    fetch(`${API_BASE}/api/update-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ type, data })
    }).then(res => {
      if (!res.ok) {
        res.json().then(data => {
          console.error(`Sync failed for ${type}: ${data.error || res.statusText}`);
          if (res.status === 401 || res.status === 403) {
            console.error("Authentication/Permission error during sync.");
          }
        }).catch(() => console.error(`Sync failed for ${type} with status ${res.status}`));
      }
    }).catch(err => console.error(`Network error during Sync for ${type}:`, err));
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

      <main>
        {active === "Home" && <HomePage dark={dark} houses={houses} authorities={authorities} management={management} studentCommittee={studentCommittee} games={games} gallery={gallery} eventDate={eventDate} />}
        {active === "Events" && <EventsPage dark={dark} games={games} />}
        {active === "Winners" && <WinnersPage dark={dark} results={results} houses={houses} sportGamesList={sportGamesList} sportGamesListWomens={sportGamesListWomens} athleticsList={athleticsList} athleticsListWomens={athleticsListWomens} />}
        {active === "Registration" && <RegistrationPage dark={dark} setRegistrations={setRegistrationsSync} houses={houses} sportGamesList={sportGamesList} sportGamesListWomens={sportGamesListWomens} athleticsList={athleticsList} athleticsListWomens={athleticsListWomens} staffGamesList={staffGamesList} staffGamesListWomens={staffGamesListWomens} registrationOpen={registrationOpen} registrationCloseTime={registrationCloseTime} closedEvents={closedEvents} maxGames={maxGames} maxAthletics={maxAthletics} />}
        {active === "Scoreboard" && <ScoreboardPage dark={dark} houses={houses} pointLog={pointLog} registrationOpen={registrationOpen} registrationCloseTime={registrationCloseTime} />}
        {active === "Star Players" && <StarPlayersPage dark={dark} starPlayers={starPlayers} houses={houses} />}
        {active === "Gallery" && <GalleryPage dark={dark} gallery={gallery} />}
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
          athleticsList={athleticsList} setAthleticsList={setAthleticsListSync}
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
        />}
        {active === "Captain" && <CaptainPortal dark={dark} houses={houses} registrations={registrations} studentsDB={studentsDB} setStudentsDB={setStudentsDBSync} />}
      </main>

      <Footer dark={dark} nav={nav.filter(n => n !== "Admin" && n !== "Captain")} houses={houses} />
      
      {launchConfig?.enabled && !hasLaunched && (
        <LaunchScreen config={launchConfig} onLaunch={() => {
          setHasLaunched(true);
          sessionStorage.setItem("launched", "true");
        }} />
      )}
    </div>
  );
}
