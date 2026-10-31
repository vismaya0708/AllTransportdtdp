  var DEST = "Masab Tank";
  var LOCALITIES = [
    { name:"LB Nagar", city:"Hyderabad" },
    { name:"Kukatpally", city:"Hyderabad" },
    { name:"KPHB", city:"Hyderabad" },
    { name:"Masab Tank", city:"Hyderabad" }
  ];

  var SAMPLE_NOTE = "Sample route and timings from the project poster — confirm with TGSRTC / Gamyam before travelling.";
  var TEAM_NOTE = "Route added by the team. Intermediate stops and departure times are not yet verified.";

  var buses = [
    { no:"218-A", from:"LB Nagar", to:"Masab Tank", duration:"1 hr 10 min", status:"Unverified", notes:SAMPLE_NOTE,
      stops:["LB Nagar","Chaitanyapuri","Dilsukhnagar","Moosarambagh","Nampally","Masab Tank (JNAFAU)"],
      schedule:["06:30 AM","08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM"] },
    { no:"218", from:"LB Nagar", to:"Masab Tank", duration:"1 hr 20 min", status:"Unverified", notes:SAMPLE_NOTE,
      stops:["LB Nagar","Kothapet","Dilsukhnagar","Malakpet","Nampally","Masab Tank (JNAFAU)"],
      schedule:["07:00 AM","08:30 AM","10:00 AM","11:30 AM","01:00 PM","03:00 PM"] },
    { no:"219", from:"Kukatpally", to:"Masab Tank", duration:"1 hr 25 min", status:"Unverified", notes:SAMPLE_NOTE,
      stops:["Kukatpally","KPHB","Ameerpet","Punjagutta","Nampally","Masab Tank (JNAFAU)"],
      schedule:["06:45 AM","08:15 AM","09:45 AM","11:15 AM","12:45 PM","02:15 PM"] },
    { no:"300", from:"Vanasthalipuram", to:"Masab Tank", duration:"1 hr 40 min", status:"Unverified", notes:SAMPLE_NOTE,
      stops:["Vanasthalipuram","LB Nagar","Dilsukhnagar","Malakpet","Nampally","Masab Tank (JNAFAU)"],
      schedule:["06:15 AM","07:45 AM","09:15 AM","10:45 AM","12:15 PM","01:45 PM"] },
    { no:"156V", from:"Mehdipatnam", to:"NGO Colony", duration:"45 min", status:"Unverified", notes:TEAM_NOTE,
      stops:["Mehdipatnam Bus Station","Attapur","Rajendranagar X Road","Shivarampally","NGO Colony"],
      schedule:["06:20 AM","07:20 AM","08:20 AM","10:20 AM","01:20 PM","05:20 PM"] },
    { no:"127K", from:"Koti", to:"Kondapur", duration:"1 hr 10 min", status:"Unverified", notes:TEAM_NOTE,
      stops:["Koti Bus Terminal","Abids","Lakdikapul","Khairatabad","Banjara Hills Rd No.1","Jubilee Hills Check Post","Madhapur","Kondapur"],
      schedule:["06:30 AM","07:45 AM","09:00 AM","11:00 AM","02:00 PM","06:30 PM"] },
    { no:"222A", from:"Koti", to:"Patancheru Bus Station", duration:"1 hr 30 min", status:"Unverified", notes:TEAM_NOTE,
      stops:["Koti Bus Terminal","Nampally","Ameerpet","SR Nagar","ESI Hospital","Miyapur","BHEL","Patancheru Bus Station"],
      schedule:["06:00 AM","07:30 AM","09:30 AM","12:00 PM","03:30 PM","07:00 PM"] },
    { no:"217C", from:"Central Bus Station", to:"Patancheru Bus Station", duration:"1 hr 20 min", status:"Unverified", notes:TEAM_NOTE,
      stops:["Central Bus Station (MGBS)","Lakdikapul","Ameerpet","Kukatpally","Miyapur","BHEL","Patancheru Bus Station"],
      schedule:["06:10 AM","07:40 AM","09:10 AM","11:40 AM","03:10 PM","06:40 PM"] },
    { no:"118M", from:"Manikonda", to:"Central Bus Station", duration:"55 min", status:"Unverified", notes:TEAM_NOTE,
      stops:["Manikonda","Gachibowli","Khajaguda X Road","Mehdipatnam","Nampally","Central Bus Station (MGBS)"],
      schedule:["06:40 AM","08:00 AM","09:40 AM","12:10 PM","03:40 PM","06:10 PM"] }
  ];
  buses.forEach(function(b){
    var mid = b.stops.slice(1, -1).slice(0, 3).join(", ");
    b.routeDesc = b.from + " to " + b.to + (mid ? " via " + mid : "");
  });

  var metroLines = [
    { id:"red", name:"Red Line", color:"#dc2626", from:"Miyapur", to:"LB Nagar", length:"29.21 km",
      first:"6:00 AM", last:"11:00 PM (up to 11:45 PM Mon–Fri)", frequency:"3–5 min peak · 6–10 min off-peak",
      interchange:"Ameerpet (Blue Line) · MG Bus Station (Green Line)", ix:["Ameerpet","MG Bus Station"],
      stations:["Miyapur","JNTU College","KPHB Colony","Kukatpally","Balanagar","Moosapet","Bharat Nagar","Erragadda","ESI Hospital","SR Nagar","Ameerpet","Punjagutta","Irrum Manzil","Khairatabad","Lakdi-ka-pul","Assembly","Nampally","Gandhi Bhavan","Osmania Medical College","MG Bus Station","Malakpet","New Market","Musarambagh","Dilsukhnagar","Chaitanyapuri","Victoria Memorial","LB Nagar"] },
    { id:"blue", name:"Blue Line", color:"#2563eb", from:"Raidurg", to:"Nagole", length:"27 km",
      first:"6:00 AM", last:"11:00 PM (up to 11:45 PM Mon–Fri)", frequency:"5–8 min peak · 8–12 min off-peak",
      interchange:"Ameerpet (Red Line) · Parade Ground (Green Line)", ix:["Ameerpet","Parade Ground (JBS)"],
      stations:["Raidurg","HITEC City","Durgam Cheruvu","Madhapur","Peddamma Gudi","Jubilee Hills Check Post","Road No. 5 Jubilee Hills","Yousufguda","Madhura Nagar","Ameerpet","Begumpet","Prakash Nagar","Rasoolpura","Paradise","Parade Ground (JBS)","Secunderabad East","Mettuguda","Tarnaka","Habsiguda","NGRI","Stadium","Uppal","Nagole"] },
    { id:"green", name:"Green Line", color:"#059669", from:"JBS Parade Ground", to:"MGBS", length:"9.6 km",
      first:"6:00 AM", last:"11:00 PM (up to 11:35 PM Mon–Fri)", frequency:"6–10 min peak · 10–15 min off-peak",
      interchange:"Parade Ground (Blue Line) · MGBS (Red Line)", ix:["JBS Parade Ground","MGBS"],
      stations:["JBS Parade Ground","Secunderabad West","Gandhi Hospital","Musheerabad","RTC X Roads","Chikkadpally","Narayanaguda","Sultan Bazaar","MGBS"] }
  ];

  var mmtsRoutes = [
    { id:"fl", name:"Lingampalli ↔ Falaknuma", tag:"Main line", duration:"~1 hr 35 min end-to-end",
      first:"~5:00 AM", last:"~10:30–11:00 PM", frequency:"Every 30–40 min (peak 5–9 AM & 5–9 PM) · sparser midday",
      stations:["Lingampalli","Chandanagar","Hafeezpet","Hi-Tech City","Borabanda","Bharatnagar","Fatehnagar","Nature Cure Hospital","Begumpet","Sanjeevaiah Park","Secunderabad (James Street)","Secunderabad Junction","Sitafalmandi","Arts College","Jamai Osmania","Vidyanagar","Kacheguda","Malakpet","Dabirpura","Yakutpura","Huppuguda","Falaknuma"] },
    { id:"medchal", name:"Secunderabad ↔ Medchal", tag:"Northern extension", duration:"~50 min",
      first:"Early morning", last:"Late evening", frequency:"Limited — a handful of services per day",
      note:"Newer corridor extending north from Secunderabad Junction through Bolarum towards Medchal." },
    { id:"ghatkesar", name:"Secunderabad ↔ Ghatkesar", tag:"Eastern extension", duration:"~45 min",
      first:"Early morning", last:"Late evening", frequency:"Limited — a handful of services per day",
      note:"Runs east from Secunderabad towards Ghatkesar, useful for ORR-side campuses." },
    { id:"umdanagar", name:"Falaknuma ↔ Umdanagar (Shamshabad line)", tag:"Southern extension", duration:"~40 min",
      first:"Early morning", last:"Evening", frequency:"Limited — a handful of services per day",
      note:"Extends south from Falaknuma towards Umdanagar, in the Shamshabad direction." }
  ];


export { DEST, LOCALITIES, buses, metroLines, mmtsRoutes };
