import React from "react";
import { Route, Switch } from "react-router-dom";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import YandexMap from "./components/Map/YandexMap";
import Profile from "./components/Profile/Profile";
import Moderation from "./components/Moderation/Moderation";
import Admin from "./components/Admin/Admin.jsx";
import Notifications from "./components/Notifications/Notifications.jsx";
import Leaderboard from "./components/Leaderboard/Leaderboard.jsx";
import PublicStats from "./components/Stats/PublicStats.jsx";
import AnalyticsDashboard from "./components/Analytics/AnalyticsDashboard.jsx";
import UserPublic from "./components/User/UserPublic.jsx";
import BottomNav from "./components/Layout/BottomNav.jsx";
import ScrollToTop from "./components/Layout/ScrollToTop.jsx";
import CursorGridGlow from "./components/CursorGridGlow.jsx";
import ToastHost from "./components/ToastHost.jsx";

function App() {
  return (
    <>
      <ScrollToTop />
      <CursorGridGlow />
      <ToastHost />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/admin" component={Admin} />
        <Route path="/moderation" component={Moderation} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/stats" component={PublicStats} />
        <Route path="/analytics" component={AnalyticsDashboard} />
        <Route path="/user/:id" component={UserPublic} />
        <Route path="/" component={YandexMap} />
      </Switch>
      <BottomNav />
    </>
  );
}

export default App;
