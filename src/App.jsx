import { useState } from "react";
import FlowCalculate from "./components/FlowCalculate";

function App() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className='text-2xl font-bold text-center mb-6'>Flow Calculation System</h1>
      <FlowCalculate />
    </div>
  );
}

export default App;
