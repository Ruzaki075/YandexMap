import React from "react";
import { useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader";
import { useAuth } from "../Auth/AuthContext";
import "./Profile.css";

export default function Profile() {
  const history = useHistory();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    history.push("/login");
  };

  return (
    <>
      <MapHeader />

      <div className="profile-page">
        <div className="profile-box">
          <h2>Профиль</h2>

          <p><strong>Email:</strong> {user?.email}</p>

          <button className="logout-btn" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </>
  );
}
