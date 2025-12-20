import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import YandexMap from './components/Map/YandexMap';
import Profile from './components/Profile/Profile';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile" component={Profile} />
        <Route path="/" component={YandexMap} />
      </Switch>
    </Router>
  );
}

export default App;