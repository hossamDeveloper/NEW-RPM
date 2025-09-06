import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import logo from "../assets/logo.png";

const Home = () => {
  const userRole = useSelector((state) => state.auth.role);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pb-16">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="w-full flex flex-col items-center pt-12 mb-10"
      >
        <img src={logo} alt="RPM Logo" className=" h-32 mb-4 drop-shadow-xl" />
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#1E3A8A] mb-4 text-center">
          Welcome to <span className="text-[#2563EB]">Nobel Software</span>
          <span className="inline-block align-middle ml-2 w-2 h-2 rounded-full bg-[#F97316]"></span>
        </h1>
        <p className="text-[#334155] text-lg md:text-xl max-w-2xl text-center mb-2">
          Your all-in-one platform for advanced flow calculations, search, and
          engineering analytics. Start optimizing your workflow today!
        </p>
      </motion.div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl w-full px-4 mx-auto">
        {userRole === "admin" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-2xl p-8 border border-[#E5EDFF] flex flex-col items-center justify-center shadow-sm text-center h-full md:justify-self-end relative"
          >
            <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
            <div className="flex flex-col items-center justify-center flex-grow">
              <h2 className="text-2xl font-bold text-[#1E3A8A] mb-2">
                Flow Calculate
              </h2>
              <p className="text-[#475569] mb-6 text-center">
                Calculate flow rates and pressures for your system with advanced
                tools.
              </p>
            </div>
            <Link
              to="/flow-calculate"
              className="w-full text-center py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#2563EB] transition-all duration-200 shadow border border-transparent hover:border-[#F59E0B]"
            >
              Start Calculating
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={`bg-white rounded-2xl p-8 border border-[#E5EDFF] shadow-sm flex flex-col justify-center text-center h-full relative ${
            userRole !== "admin" ? "md:col-span-2" : "md:justify-self-start"
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#FDBA74]"></span>
          <div className="flex flex-col items-center justify-center flex-grow">
            <h2 className="text-2xl font-bold text-[#1E3A8A] mb-2">Flow Search</h2>
            <p className="text-[#475569] mb-6 text-center">
              Search and view existing flow calculations with powerful filters
              and analytics.
            </p>
          </div>
          <Link
            to="/flow-search"
            className="w-full text-center py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#2563EB] transition-all duration-200 shadow border border-transparent hover:border-[#F59E0B]"
          >
            Start Selecting
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
