import { createContext, useState } from "react";
import { useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

export const UserContext = createContext();

const isDemo = import.meta.env.VITE_DEMO;

export const UserProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      localStorage.getItem("educatch_isLoggedIn") === "true" ||
      isDemo === "true"
  );
  const [user, setUser] = useState({
    id: isDemo ? "10" : localStorage.getItem("educatch_userId"),
    role: isDemo ? "admin" : localStorage.getItem("educatch_userRole"),
    role_id: isDemo ? null : localStorage.getItem("educatch_userRoleId"),
  });

  const handleSignIn = ({
    id,
    role,
    role_id,
    access_token,
    refresh_token,
    remember,
  }) => {
    setIsLoggedIn(true);
    setUser({ role: role, role_id: role_id, id: id });
    if (remember) {
      localStorage.setItem("educatch_isLoggedIn", "true");
      localStorage.setItem("educatch_userId", id);
      localStorage.setItem("educatch_userRole", role);
      localStorage.setItem("educatch_userRoleId", role_id);
    } else localStorage.setItem("educatch_isLoggedIn", "false"); // clear local storage
    localStorage.setItem("educatch_access_token", access_token);
    localStorage.setItem("educatch_refresh_token", refresh_token);
    navigate("/timetable");
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUser({ role_id: null, role: null, id: null });
    localStorage.removeItem("educatch_isLoggedIn");
    localStorage.removeItem("educatch_userId");
    localStorage.removeItem("educatch_userRole");
    localStorage.removeItem("educatch_userRoleId");
    localStorage.removeItem("educatch_upcomingInvoicesVisible");
    localStorage.removeItem("educatch_upcomingReportsVisible");
    localStorage.removeItem("educatch_weeklyReportsView");
    localStorage.removeItem("educatch_access_token");
    localStorage.removeItem("educatch_refresh_token");
    navigate("/login");
    queryClient.clear();
  };

  return (
    <UserContext.Provider
      value={{ isLoggedIn, user, handleSignIn, handleSignOut }}
    >
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
