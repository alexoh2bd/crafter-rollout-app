import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./routes/Home";
import Play from "./routes/Play";
import Imagination from "./routes/Imagination";
import WorldModelDemo from "./routes/WorldModelDemo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
        <Route path="/imagination" element={<Imagination />} />
        <Route path="/wm-demo" element={<WorldModelDemo />} />
      </Routes>
    </BrowserRouter>
  );
}
