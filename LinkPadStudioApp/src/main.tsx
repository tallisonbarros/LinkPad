import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

function StudioBootstrap() {
  useEffect(() => {
    document.getElementById("studio-boot")?.remove();
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StudioBootstrap />
  </React.StrictMode>
);
