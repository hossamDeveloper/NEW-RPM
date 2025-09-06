import { useState } from "react";
import AddUser from "../Components/Control/AddUser";
import AllUsers from "../Components/Control/AllUsers";
import AllModels from "../Components/Control/AllModels";
import AddModel from "../Components/Control/AddModel";

const Control = () => {
  const [activeSection, setActiveSection] = useState("add-user");

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#E5EDFF]">
        <div className="p-4">
          <h1 className="text-xl font-bold text-[#1E3A8A] mb-2">Control Panel</h1>
          <div className="h-1 w-16 bg-[#FDBA74] rounded"></div>
          <nav className="space-y-2 mt-4">
            <button
              onClick={() => setActiveSection("add-user")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "add-user"
                  ? "bg-[#D6E4FF] text-[#1E40AF] border border-[#C7DAFF] border-l-4 border-l-[#F59E0B]"
                  : "text-[#1F3B73] hover:bg-[#EEF4FF]"
              }`}
            >
              Add User
            </button>
            <button
              onClick={() => setActiveSection("all-users")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "all-users"
                  ? "bg-[#D6E4FF] text-[#1E40AF] border border-[#C7DAFF] border-l-4 border-l-[#F59E0B]"
                  : "text-[#1F3B73] hover:bg-[#EEF4FF]"
              }`}
            >
              All Users
            </button>

            <button
              onClick={() => setActiveSection("add-model")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "add-model"
                  ? "bg-[#D6E4FF] text-[#1E40AF] border border-[#C7DAFF] border-l-4 border-l-[#F59E0B]"
                  : "text-[#1F3B73] hover:bg-[#EEF4FF]"
              }`}
            >
              Add Model
            </button>

            <button
              onClick={() => setActiveSection("all-models")}
              className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSection === "all-models"
                  ? "bg-[#D6E4FF] text-[#1E40AF] border border-[#C7DAFF] border-l-4 border-l-[#F59E0B]"
                  : "text-[#1F3B73] hover:bg-[#EEF4FF]"
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
