import { createSlice } from '@reduxjs/toolkit';

// Load initial state from localStorage
const loadState = () => {
  try {
    const serializedData = localStorage.getItem('allGeneratedData');
    if (serializedData === null) {
      return {
        generatedData: [],
        allRpmPoints: {},
        selectedRpm: null
      };
    }
    return {
      generatedData: JSON.parse(serializedData),
      allRpmPoints: {},
      selectedRpm: null
    };
  } catch (err) {
    console.error('Error loading data from localStorage:', err);
    return {
      generatedData: [],
      allRpmPoints: {},
      selectedRpm: null
    };
  }
};

// Save data to localStorage
const saveData = (data) => {
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem('allGeneratedData', serializedData);
  } catch (err) {
    console.error('Error saving data to localStorage:', err);
  }
};

const initialState = loadState();

const flowSlice = createSlice({
  name: 'flow',
  initialState,
  reducers: {
    setGeneratedData: (state, action) => {
      state.generatedData = action.payload;
      // Save only the generated data
      saveData(action.payload);
    },
    setAllRpmPoints: (state, action) => {
      state.allRpmPoints = action.payload;
    },
    setSelectedRpm: (state, action) => {
      state.selectedRpm = action.payload;
    },
    clearFlowData: (state) => {
      state.generatedData = [];
      state.allRpmPoints = {};
      state.selectedRpm = null;
      // Clear localStorage
      localStorage.removeItem('allGeneratedData');
    }
  }
});

export const { setGeneratedData, setAllRpmPoints, setSelectedRpm, clearFlowData } = flowSlice.actions;
export default flowSlice.reducer; 