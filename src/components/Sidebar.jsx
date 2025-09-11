import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Button } from "antd";
import { LogOut, RefreshCcw } from "react-feather";
import { useContext } from "react";
import { UserContext } from "../UserContext";
import "./Sidebar.css";
import useResetDemoDb from "../hooks/useResetDemoDb";
import logo from "../assets/EduCatch-logo.png";

const isDemo = import.meta.env.VITE_DEMO;

export default function Sidebar(props) {
  const { handleSignOut } = useContext(UserContext);
  const { mutate: resetDemo, isLoading } = useResetDemoDb();

  const routesButtons = props.routes.map((route) => {
    const Icon = route.icon;
    return (
      <Link
        key={route.path}
        to={route.path}
        className="button sidebar--nav-button"
        style={{
          backgroundColor:
            route.path === "/" + props.currentRoute.split("/")[1]
              ? "var(--bg-color-light-blue)"
              : "transparent",
        }}
        aria-label={route.name}
      >
        <div className="sidebar--nav-button-icon">
          {Icon && <Icon size={18} />}
        </div>
        <p className="sidebar--nav-button-text">{route.name}</p>
      </Link>
    );
  });

  return (
    <div className="sidebar">
      <section>
        <img className="sidebar--logo" src={logo} alt="EduCatch logo" />
        <nav className="sidebar--nav">
          <br />
          {routesButtons}
        </nav>
      </section>
      <footer>
        {isDemo === "true" ? (
          <Button
            type="primary"
            loading={isLoading}
            onClick={() => resetDemo()}
            icon={<RefreshCcw size={14} />}
          >
            Reset Demo
          </Button>
        ) : (
          <Button
            onClick={handleSignOut}
            icon={<LogOut size={15} style={{ transform: "rotate(180deg)" }} />}
          >
            Logout
          </Button>
        )}
      </footer>
    </div>
  );
}

Sidebar.propTypes = {
  routes: PropTypes.array,
  currentRoute: PropTypes.string,
};
