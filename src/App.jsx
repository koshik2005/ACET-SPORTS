import { useState, useEffect } from "react";
import "./index.css";
import { Header, Footer } from "./Layout.jsx";
import { HomePage, EventsPage } from "./Pages1.jsx";
import { RegistrationPage, ScoreboardPage, GalleryPage, WinnersPage } from "./Pages2.jsx";
import { AdminPage } from "./AdminPage.jsx";
import { CaptainPortal } from "./CaptainPortal.jsx";

export default function App() {
  const [active, setActive] = useState("Home");
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
  const [loading, setLoading] = useState(true);

  // Configuration from API
  const [nav, setNav] = useState([]);
  const [sportGamesList, setSportGamesList] = useState([]);
  const [athleticsList, setAthleticsList] = useState([]);
  const [authorityRoles, setAuthorityRoles] = useState([]);
  const [managementRoles, setManagementRoles] = useState([]);
  const [eventDate, setEventDate] = useState({ date: "", time: "" });
  const [emptyGame, setEmptyGame] = useState({ name: "", type: "game", venue: "", official: "", status: "Upcoming", start: "", end: "", participants: "" });

  const API_BASE = "https://api.acet-sports.favoflex.com/";

  useEffect(() => {
    fetch(`${API_BASE}/api/public-state`)
      .then(res => res.json())
      .then(data => {
        if (data.houses) setHouses(data.houses);
        if (data.authorities) setAuthorities(data.authorities);
        if (data.management) setManagement(data.management);
        if (data.studentCommittee) setStudentCommittee(data.studentCommittee);
        if (data.games) setGames(data.games);
        if (data.gallery) setGallery(data.gallery);
        if (data.registrations) setRegistrations(data.registrations);
        if (data.pointLog) setPointLog(data.pointLog);
        if (data.studentsDB) setStudentsDB(data.studentsDB);
        if (data.results) setResults(data.results);

        // Set config
        if (data.nav) setNav(data.nav);
        if (data.sportGamesList) setSportGamesList(data.sportGamesList);
        if (data.athleticsList) setAthleticsList(data.athleticsList);
        if (data.authorityRoles) setAuthorityRoles(data.authorityRoles);
        if (data.managementRoles) setManagementRoles(data.managementRoles);
        if (data.eventDate) setEventDate(data.eventDate);
        if (data.emptyGame) setEmptyGame(data.emptyGame);

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
        if (res.status === 401 || res.status === 403) {
          console.error("Unauthorized state sync attempt.");
        }
      }
    }).catch(err => console.error(`Sync failed for ${type}:`, err));
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
  const setSportGamesListSync = wrap(setSportGamesList, "sportGamesList");
  const setAthleticsListSync = wrap(setAthleticsList, "athleticsList");
  const setAuthorityRolesSync = wrap(setAuthorityRoles, "authorityRoles");
  const setManagementRolesSync = wrap(setManagementRoles, "managementRoles");
  const setEventDateSync = wrap(setEventDate, "eventDate");

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

      <Header active={active} setActive={setActive} dark={dark} setDark={setDark} nav={nav} games={games} />

      <main>
        {active === "Home" && <HomePage dark={dark} houses={houses} authorities={authorities} management={management} studentCommittee={studentCommittee} games={games} gallery={gallery} eventDate={eventDate} />}
        {active === "Events" && <EventsPage dark={dark} games={games} />}
        {active === "Winners" && <WinnersPage dark={dark} results={results} houses={houses} sportGamesList={sportGamesList} athleticsList={athleticsList} />}
        {active === "Registration" && <RegistrationPage dark={dark} registrations={registrations} setRegistrations={setRegistrationsSync} studentsDB={studentsDB} houses={houses} sportGamesList={sportGamesList} athleticsList={athleticsList} />}
        {active === "Scoreboard" && <ScoreboardPage dark={dark} houses={houses} pointLog={pointLog} />}
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
          sportGamesList={sportGamesList} setSportGamesList={setSportGamesListSync}
          athleticsList={athleticsList} setAthleticsList={setAthleticsListSync}
          authorityRoles={authorityRoles} setAuthorityRoles={setAuthorityRolesSync}
          managementRoles={managementRoles} setManagementRoles={setManagementRolesSync}
          eventDate={eventDate} setEventDate={setEventDateSync}
          emptyGame={emptyGame}
        />}
        {active === "Captain" && <CaptainPortal dark={dark} houses={houses} registrations={registrations} studentsDB={studentsDB} setStudentsDB={setStudentsDBSync} />}
      </main>

      <Footer dark={dark} nav={nav} houses={houses} />
    </div>
  );
}
