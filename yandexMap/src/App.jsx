import React from "react";
import { Switch, Route } from "react-router-dom";

import YandexMap from "./components/Map/YandexMap";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import Profile from "./components/Profile/Profile";

function App() {
  return (
    <Switch>
      <Route exact path="/" component={YandexMap} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/  " component={Profile} />
    </Switch>
  );
}

export default App;
