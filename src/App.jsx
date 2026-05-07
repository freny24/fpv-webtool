import { useState } from "react";
import MapView from "./MapView";

export default function App() {
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate] = useState("2022-12-31");

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MapView
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />
    </div>
  );
}