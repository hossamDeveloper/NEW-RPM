export const descriptionsData = {
  // Axial Fans
  NEI3D: "The Axial Box Inline Fan is a compact ventilation unit designed for efficient air supply and exhaust within duct systems. It features a high-performance axial impeller and a durable steel box casing for reliable operation and easy installation.\nSuitable for commercial and industrial HVAC applications requiring steady and efficient airflow.",
  
  NEID: "The Axial Ducted Fan (NEID) is designed for high airflow performance in ducted ventilation systems. It features a heavy-duty cylindrical casing with a precision-balanced axial impeller to ensure efficient and reliable air movement.\nSuitable for industrial and commercial HVAC applications, it provides strong airflow with stable operation and easy integration into duct networks.",
  
  NEIDS: "The Axial Fire Rated Smoke Fan (NEIDS) is specially designed for smoke extraction and emergency ventilation systems. Built with a heavy-duty steel casing and high-temperature resistant axial impeller, it ensures reliable operation under fire conditions.\nIdeal for car parks, tunnels, and commercial buildings, it provides powerful airflow and complies with fire safety requirements for smoke control systems.",
  
  NEI2D: "The Axial Jet Fan (NEI2D) is engineered for efficient air movement and smoke control in enclosed spaces. Designed with a robust cylindrical steel casing and high-performance axial impeller, it delivers powerful thrust for ventilation without extensive ductwork.\nIdeal for car parks, tunnels, and large commercial areas, it ensures reliable airflow and effective environmental control.",
  
  NRT: "The Axial Roof Top Fan (NRT) is designed for efficient roof-mounted ventilation and air extraction. It features a weatherproof dome cover and durable steel construction to ensure reliable performance in outdoor conditions.\nIdeal for factories, warehouses, and commercial buildings, it provides effective airflow and continuous ventilation for various HVAC applications.",
  
  NETD: "The Axial Wall Mounted Fan (NETD) is designed for direct wall installation to provide efficient air extraction and ventilation. It features a heavy-duty steel frame and high-performance axial impeller for reliable airflow and long service life.\nIdeal for factories, warehouses, and commercial spaces requiring effective and continuous ventilation.",
  
  NETD_FR: "The Axial Wall Mounted Fan (Fire Rated) (NETD_FR) is designed for direct wall installation to provide efficient air extraction and ventilation. It features a heavy-duty steel frame and high-performance axial impeller for reliable airflow and long service life.\nIdeal for factories, warehouses, and commercial spaces requiring effective and continuous ventilation.",
  
  // Centrifugal Fans
  NBR: "The NBR Series Centrifugal Fan is designed for high-efficiency air handling and industrial ventilation. Featuring a backward curved impeller and heavy-duty steel construction, it delivers powerful, reliable airflow with low noise and minimal maintenance.\nIdeal for factories, warehouses, HVAC systems, and large commercial spaces requiring continuous and high-volume ventilation.",
  
  NBS: "The NBS Series Centrifugal Fan is designed for high-efficiency air handling and industrial ventilation. Featuring a forward curved multi-blade impeller and heavy-duty steel construction, it delivers powerful and consistent airflow with quiet operation and long service life.\nIdeal for factories, warehouses, HVAC systems, and large commercial spaces requiring continuous and high-volume ventilation.",
  
  NBRS: "The NBRS Series Centrifugal Fan is a heavy-duty industrial unit designed for demanding ventilation and air handling applications. Featuring a robust steel housing with belt-driven transmission and large-diameter ducting connections, it delivers high static pressure and powerful airflow in tough operating environments.\nIdeal for industrial plants, foundries, dust extraction systems, and process ventilation requiring heavy-duty and continuous-duty performance.",
  
  'NBR-D': "The NBR-D Series is a double inlet centrifugal fan featuring dual backward curved impellers mounted on a single shaft, delivering twice the airflow capacity within a compact and sturdy steel housing. This design ensures balanced airflow, reduced vibration, and superior energy efficiency for large-scale ventilation demands.\nIdeal for HVAC systems, air handling units, industrial ventilation, and applications requiring high air volume with minimal footprint.",
  
  'NBS-D': "The NBS-D Series is a double inlet centrifugal fan featuring dual forward curved multi-blade impellers on a single shaft, delivering high air volume with smooth and quiet operation. Its compact direct-drive design makes it easy to integrate into tight spaces while maintaining excellent ventilation performance.\nIdeal for HVAC systems, air handling units, commercial buildings, and applications requiring high airflow with low noise levels.",
  
  'NBR-D FAN SECTION TYPE': "The NBR-D Fan Section Type is a double inlet centrifugal fan housed within a fully enclosed, acoustically insulated casing, designed for seamless integration into ducted HVAC and air handling systems. The robust paneled enclosure minimizes noise transmission and protects internal components, ensuring reliable and quiet operation in demanding environments.\nIdeal for central air handling units, cleanrooms, hospitals, commercial buildings, and applications requiring high airflow with superior noise control.",
  
  'NBS-D FAN SECTION TYPE': "The NBS-D Fan Section Type is a double inlet centrifugal fan with forward curved multi-blade impellers, housed within a fully enclosed, acoustically insulated casing, designed for seamless integration into ducted HVAC and air handling systems. The robust paneled enclosure minimizes noise transmission and protects internal components, ensuring reliable and quiet operation in demanding environments.\nIdeal for central air handling units, cleanrooms, hospitals, commercial buildings, and applications requiring high airflow with low noise levels.",
  
  NPD: "The NPD Series is a high-performance centrifugal fan featuring a large-diameter impeller housed in a heavy-duty steel scroll casing, driven by a belt-driven motor mounted on a rigid base frame. Designed for high static pressure and high air volume applications, it delivers powerful and consistent airflow with robust construction for continuous industrial use.\nIdeal for industrial ventilation, dust extraction, pneumatic conveying, process air systems, and applications requiring high pressure and heavy-duty performance.",
  
  NPE: "The NPE Series is a compact high-pressure centrifugal fan featuring a robust scroll casing and direct-coupled motor, designed for efficient air handling in limited spaces. Its sturdy construction and aerodynamic impeller deliver reliable high-pressure airflow with minimal vibration and easy installation.\nIdeal for industrial ventilation, pneumatic conveying, dust extraction, and process air applications requiring high pressure in a compact and cost-effective unit.",
  
  NPF: "The NPF Series is a single-stage high-pressure centrifugal fan featuring a precision-cast aluminum or steel impeller with an open radial blade design, directly coupled to a compact motor. Its lightweight yet durable construction delivers high static pressure with efficient airflow and minimal maintenance requirements.\nIdeal for pneumatic conveying, air knife systems, combustion air supply, industrial drying, and applications requiring high-pressure airflow in a compact and lightweight unit."
};

// Helper function to get description for a model
export const getDescription = (fanCategory, axialType, series) => {
  if (fanCategory === 'axial' && axialType) {
    // Map special UI-only axial types to real description keys
    const key = axialType === 'NEIDS_RANGE' ? 'NEIDS' : axialType;
    return descriptionsData[key] || null;
  }
  if (fanCategory === 'centrifugal' && series) {
    // Handle special cases for NBR-D and NBS-D variants
    if (series === 'NBR-D FAN SECTION TYPE') {
      return descriptionsData['NBR-D FAN SECTION TYPE'] || descriptionsData['NBR-D'] || null;
    }
    if (series === 'NBS-D FAN SECTION TYPE') {
      return descriptionsData['NBS-D FAN SECTION TYPE'] || descriptionsData['NBS-D'] || null;
    }
    // Normalize series name (handle NBR_D, NBS_D variations)
    const normalizedSeries = series.replace(/_/g, '-');
    return descriptionsData[normalizedSeries] || descriptionsData[series] || null;
  }
  return null;
};
