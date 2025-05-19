import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../App";
import logo from "../assets/logo.png";

const Home = () => {
  const { userRole } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#021F59] via-[#03178C] to-[#034AA6] flex flex-col items-center justify-start pb-16">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="w-full flex flex-col items-center pt-12 mb-10"
      >
        <img src={logo} alt="RPM Logo" className=" h-32 mb-4 drop-shadow-xl" />
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 drop-shadow-lg text-center">
          Welcome to <span className="text-[#00B4D8]">RPM Calculator</span>
        </h1>
        <p className="text-white/90 text-lg md:text-xl max-w-2xl text-center mb-2">
          Your all-in-one platform for advanced flow calculations, search, and
          engineering analytics. Start optimizing your workflow today!
        </p>
      </motion.div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl w-full px-4">
        {userRole === "admin" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 flex flex-col items-center shadow-lg justify-between text-center"
          >
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Flow Calculate
              </h2>
              <p className="text-white/90 mb-6 text-center">
                Calculate flow rates and pressures for your system with advanced
                tools.
              </p>
            </div>
            <Link
              to="/flow-calculate"
              className="w-full text-center py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
            >
              Start Calculating
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 items-center shadow-lg flex flex-col justify-between text-center"
        >
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Flow Search</h2>
            <p className="text-white/90 mb-6 text-center">
              Search and view existing flow calculations with powerful filters
              and analytics.
            </p>
          </div>
          <Link
            to="/flow-search"
            className="w-full text-center py-3 px-4 rounded-xl text-white font-semibold bg-gradient-to-r from-[#03178C] to-[#034AA6] hover:from-[#034AA6] hover:to-[#03178C] transition-all duration-200 shadow-lg"
          >
            Start Searching
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
