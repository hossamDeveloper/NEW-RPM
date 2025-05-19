import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  allRpmPoints: {},
  calculatedPoints: [],
  selectedRpm: null,
  nextRpmPoints: [],
  allDataGenerated: []
};

const flowSlice = createSlice({
  name: 'flow',
  initialState,
  reducers: {
    setAllRpmPoints: (state, action) => {
      state.allRpmPoints = action.payload;
    },
    setCalculatedPoints: (state, action) => {
      state.calculatedPoints = action.payload;
    },
    setSelectedRpm: (state, action) => {
      state.selectedRpm = action.payload;
    },
    setNextRpmPoints: (state, action) => {
      state.nextRpmPoints = action.payload;
    },
    setAllDataGenerated: (state, action) => {
      state.allDataGenerated = action.payload;
    },
    clearFlowData: (state) => {
      state.allRpmPoints = {};
      state.calculatedPoints = [];
      state.selectedRpm = null;
      state.nextRpmPoints = [];
      state.allDataGenerated = [];
    }
  }
});

export const {
  setAllRpmPoints,
  setCalculatedPoints,
  setSelectedRpm,
  setNextRpmPoints,
  setAllDataGenerated,
  clearFlowData
} = flowSlice.actions;

export default flowSlice.reducer; 