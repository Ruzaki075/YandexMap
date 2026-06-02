import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import "./styles/theme.css";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import YandexMap from "./components/Map/YandexMap";
import Profile from "./components/Profile/Profile";
import Moderation from "./components/Moderation/Moderation";
import Admin from "./components/Admin/Admin.jsx";
import Notifications from "./components/Notifications/Notifications.jsx";
import PublicStats from "./components/Stats/PublicStats.jsx";
import AnalyticsDashboard from "./components/Analytics/AnalyticsDashboard.jsx";
import UserPublic from "./components/User/UserPublic.jsx";
import AppHeader from "./components/Layout/AppHeader.jsx";
import BottomNav from "./components/Layout/BottomNav.jsx";
import ScrollToTop from "./components/Layout/ScrollToTop.jsx";
import ToastHost from "./components/ToastHost.jsx";
import AchievementListener from "./components/Gamification/AchievementListener.jsx";
import Results from "./pages/Results.jsx";
import About from "./pages/About.jsx";

const AUTH_ROUTES = new Set(["/login", "/register"]);

function AppRoutes() {
  const { pathname } = useLocation();
  const hideHeader = AUTH_ROUTES.has(pathname);
  const isMap = pathname === "/";

  return (
    <div className="app-root">
      <ScrollToTop />
      <ToastHost />
      <AchievementListener />
      {!hideHeader ? <AppHeader /> : null}
      <main
        className={`app-main${hideHeader ? " app-main--auth" : ""}${
          isMap ? " app-main--map" : ""
        }`}
      >
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/admin" component={Admin} />
          <Route path="/moderation" component={Moderation} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/profile" component={Profile} />
          <Route path="/leaderboard">
            <Redirect to="/results" />
          </Route>
          <Route path="/stats" component={PublicStats} />
          <Route path="/analytics" component={AnalyticsDashboard} />
          <Route path="/user/:id" component={UserPublic} />
          <Route path="/results" component={Results} />
          <Route path="/about" component={About} />
          <Route path="/" component={YandexMap} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return <AppRoutes />;
}
