import { useState } from "react";
import AddUser from "./Control/AddUser";
import AllUsers from "./Control/AllUsers";
import AllModels from "./Control/AllModels";
import AddModel from "./Control/AddModel";

const Control = () => {
  const [activeSection, setActiveSection] = useState("add-user");

  return (
    <div className="min-h-screen bg-[#021F59] flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#03178C]/90 backdrop-blur-md border-r border-[#034AA6]/30">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white mb-6">Control Panel</h1>
          <nav className="space-y-2">
            <button
              onClick={() => setActiveSection("add-user")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "add-user"
                  ? "bg-[#034AA6] text-white"
                  : "text-white/70 hover:bg-[#034AA6]/50"
              }`}
            >
              Add User
            </button>
            <button
              onClick={() => setActiveSection("all-users")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "all-users"
                  ? "bg-[#034AA6] text-white"
                  : "text-white/70 hover:bg-[#034AA6]/50"
              }`}
            >
              All Users
            </button>

            <button
              onClick={() => setActiveSection("add-model")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "add-model"
                  ? "bg-[#034AA6] text-white"
                  : "text-white/70 hover:bg-[#034AA6]/50"
              }`}
            >
              Add Model
            </button>

            <button
              onClick={() => setActiveSection("all-models")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "all-models"
                  ? "bg-[#034AA6] text-white"
                  : "text-white/70 hover:bg-[#034AA6]/50"
              }`}
            >
              All Models
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeSection === "add-user" ? (
          <AddUser />
        ) : activeSection === "all-users" ? (
          <AllUsers />
        ) : activeSection === "add-model" ? (
          <AddModel />
        ) : (
          <AllModels />
        )}
      </div>
    </div>
  );
};

export default Control;
