import React from "react";
import { Switch, Route } from "react-router-dom";

import YandexMap from "./components/Map/YandexMap";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";

function App() {
  return (
    <Switch>
      <Route exact path="/" component={YandexMap} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
    </Switch>
  );
}

export default App;
