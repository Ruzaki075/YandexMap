import { useAuth } from "../Auth/AuthContext";  

const Profile = () => {
  const { user, logout } = useAuth();
  
  return (
    <div>
      <h1>Профиль</h1>
      <p>Email: {user?.email}</p>
      <button onClick={logout}>Выйти</button>
    </div>
  );
};

export default Profile;