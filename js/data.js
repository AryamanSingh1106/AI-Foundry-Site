/* =====================================================================
   AI FOUNDRY — SITE CONTENT
   Edit this file to change anything shown on the website.
   (No coding needed — just change the text inside the quotes.)
   To load this data from a server/database instead, see README.md
   ===================================================================== */
window.SITE_DATA = {
  /* Settings: EMAIL receives join requests (fallback). FORM_ENDPOINT = form-service URL. DATA_URL = JSON API URL (leave '' to use this file). */
  CONFIG: {
    EMAIL: "vidhayank.singh@universalai.in",
    FORM_ENDPOINT: "",
    DATA_URL: "",
  },
  /* Scroll-reveal sentence in 'Who we are'. Words wrapped in *stars* turn orange. */
  MANIFESTO:
    "A foundry is where raw material is shaped under *heat* into something of use. That is precisely our work with *ideas*. We begin with a *real problem* and leave with something that *runs*.",
  /* k: 'up' (upcoming) or 'past'.  r: optional link (registration for upcoming / recap for past). */
  EVENTS: [
    {
      k: "up",
      d: "TBA · 2026",
      tm: "10:00 AM",
      v: "AI Centre of Excellence",
      t: "Innovation Challenge",
      x: "Ideation sprint: bring a real campus problem, leave with a framed scope and a team.",
      l: "A one-day ideation sprint where participants pick a real problem from the Problem Bank, frame it using design thinking, and form a build squad. Every team leaves with a clear problem statement, a scope and a mentor.",
      hl: [
        "Pick a real problem from the Problem Bank",
        "Frame it with design thinking",
        "Form a squad and get a mentor",
      ],
    },
    {
      k: "up",
      d: "TBA · 2026",
      tm: "3:00 PM",
      v: "Seminar Hall",
      t: "Idea Clinic",
      x: "Half-formed idea in, framed problem out.",
      l: "An open clinic with mentors for anyone holding a rough idea. Bring it as it is; you leave with a sharper problem statement and the next step.",
      hl: [
        "Open to all students",
        "One-to-one mentor feedback",
        "No prior AI experience needed",
      ],
    },
    {
      k: "up",
      d: "TBA · 2026",
      tm: "11:00 AM",
      v: "Main Auditorium",
      t: "Demo Day",
      x: "Working prototypes shown to faculty, industry mentors and peers.",
      l: "Build squads present working AI prototypes to faculty and industry mentors. The strongest proofs of concept move on to the Incubation Track.",
      hl: [
        "Live prototype demos",
        "Feedback from mentors",
        "Top projects enter incubation",
      ],
    },
    {
      k: "past",
      d: "2026",
      tm: "",
      v: "AI Centre of Excellence",
      t: "AI Foundry Launch",
      x: "The club opens its doors.",
      l: "The official launch of AI Foundry at the AI Centre of Excellence, introducing the vision, the four-stage model and how students can join a build squad.",
      hl: [
        "Vision and mission unveiled",
        "Four-stage model introduced",
        "First members onboarded",
      ],
    },
    {
      k: "past",
      d: "2026",
      tm: "",
      v: "Campus",
      t: "Design Thinking Workshop",
      x: "From observing a problem to framing it, before any code.",
      l: "A hands-on workshop on observing real problems, interviewing the people affected and framing the problem before writing a line of code.",
      hl: [
        "Observe and interview",
        "Frame the problem",
        "Validate before building",
      ],
    },
  ],
  /* real:true makes the name bright white; false shows it dimmed (placeholder look). */
  COLLABS: [
    {
      name: "Universal AI University",
      real: true,
    },
    {
      name: "AI Centre of Excellence",
      real: true,
    },
    {
      name: "Partner name",
      real: false,
    },
    {
      name: "Partner name",
      real: false,
    },
    {
      name: "Partner name",
      real: false,
    },
    {
      name: "Partner name",
      real: false,
    },
    {
      name: "Partner name",
      real: false,
    },
    {
      name: "Partner name",
      real: false,
    },
  ],
  /* Add as many members as you like. */
  MEMBERS: [
    {
      name: "Member Name",
      role: "Squad Lead",
    },
    {
      name: "Member Name",
      role: "Build Squad",
    },
    {
      name: "Member Name",
      role: "Build Squad",
    },
    {
      name: "Member Name",
      role: "Design",
    },
    {
      name: "Member Name",
      role: "Build Squad",
    },
    {
      name: "Member Name",
      role: "Research",
    },
    {
      name: "Member Name",
      role: "Build Squad",
    },
    {
      name: "Member Name",
      role: "Outreach",
    },
  ],
  /* Lead team: photos live in the assets/ folder. */
  LEADERS: [
    {
      name: "Vidhayank Singh Rolaniya",
      role: "President",
      email: "vidhayank.singh@universalai.in",
      photo: "assets/president.jpg",
    },
    {
      name: "Aryaman Singh",
      role: "Vice President",
      email: "aryaman.singh@universalai.in",
      photo: "assets/vice-president.jpg",
    },
    {
      name: "Pushpak Sarode",
      role: "General Secretary",
      email: "pushpak.sarode@universalai.in",
      photo: "assets/general-secretary.jpg",
    },
  ],
  /* message is a list of paragraphs. The last one is shown in orange. */
  PATRON: {
    name: "Mr. Rajesh Bhise",
    role: "Patron, AI Foundry Club",
    photo: "assets/patron.jpg",
    signature: "assets/signature.jpg",
    message: [
      "It gives me immense pleasure to welcome you to AI Foundry — a platform where ideas are transformed into innovation and real-world problems become opportunities to create meaningful solutions.",
      "The true strength of this club lies not merely in learning AI, but in identifying problems, building solutions, experimenting fearlessly, and turning promising ideas into impactful innovations.",
      "Discover. Build. Innovate. Impact.",
    ],
  },
  /* 'Why we exist' cards */
  WHY: [
    {
      title: "Problems go unsolved",
      text: "Campus, community and industry carry problems nobody has had the time or tools to fix.",
    },
    {
      title: "Theory without shipping",
      text: "Students learn AI in classrooms but rarely take a solution from idea to something that runs.",
    },
    {
      title: "No space to prototype",
      text: "Innovation needs a place to experiment, fail quickly and try the next version.",
    },
    {
      title: "Proof of work matters",
      text: "Industry and investors look for builders with real projects, not only certificates.",
    },
    {
      title: "Ideas without a home",
      text: "Good ideas surface in labs and hostels, then quietly disappear.",
    },
    {
      title: "Building needs company",
      text: "A solution rarely survives one person alone. It needs a team, a mentor and a deadline.",
    },
  ],
  /* 'What we do' scroll cards */
  PAN: [
    {
      num: "01",
      title: "Problem Discovery & Design Thinking",
      text: "We start from the problem, not the technology. Observe, interview, frame and validate before a line of code.",
    },
    {
      num: "02",
      title: "Prototyping & AI Products",
      text: "Teams build AI Proofs of Concept, test them with real users and improve in short, iterative cycles.",
    },
    {
      num: "03",
      title: "Innovation & Social Impact",
      text: "Solutions don’t stop at a demo — they go to campus, community, or become a product or venture.",
    },
    {
      num: "04",
      title: "Cultivating Innovators",
      text: "Beyond projects, we build people who can lead a team and carry an idea to the finish.",
    },
  ],
  /* 'Inside the Foundry' cards (continue the scroll row) */
  INS: [
    {
      title: "Problem Bank",
      text: "Open list of problems from campus, faculty, industry and community.",
    },
    {
      title: "Build Squads",
      text: "Small teams, one problem, a mentor and a clear deliverable.",
    },
    {
      title: "Demo Days",
      text: "Prototypes shown to mentors and peers; feedback feeds the next cycle.",
    },
    {
      title: "Incubation Track",
      text: "Strongest PoCs become products, deployments, patents or startups.",
    },
  ],
  /* The 4 stages */
  PIPE: [
    {
      title: "Discover",
      text: "Find and frame the problem",
    },
    {
      title: "Build",
      text: "Prototype and test the solution",
    },
    {
      title: "Innovate",
      text: "Refine, iterate, differentiate",
    },
    {
      title: "Impact",
      text: "Deploy, scale or commercialise",
    },
  ],
  /* Missions */
  MIS: [
    {
      title: "Discovering Problems",
      text: "Meaningful problems faced by society, industry, students, faculty and the university.",
    },
    {
      title: "Building Solutions",
      text: "AI-driven PoCs and prototypes through rapid experimentation.",
    },
    {
      title: "Creating Impact",
      text: "Practical, scalable and commercially viable products.",
    },
    {
      title: "Cultivating Innovators",
      text: "Empowering students and faculty to become innovators and entrepreneurs.",
    },
    {
      title: "Driving Innovation",
      text: "Challenges, ideation programmes and problem-discovery initiatives.",
    },
    {
      title: "Solving Campus Problems",
      text: "Intelligent solutions for real challenges within the university.",
    },
  ],
  /* Projects & research. k: 'on' (ongoing) | 'done' (completed).  type: 'Project' | 'Research'.
     st: current stage 0-3 (Discover, Build, Innovate, Impact) — ongoing only.  p: progress % — ongoing only.
     tech: tags.  lead / d: shown in the detail card.  hl: highlights / outcomes.  r: optional link. */
  PROJECTS: [
    {
      k: "on",
      type: "Project",
      t: "Campus Assistant",
      x: "An AI assistant that answers student questions on timetables, rules and campus services.",
      l: "A conversational assistant trained on university documents so students get instant, reliable answers instead of searching notice boards and PDFs.",
      st: 1,
      p: 62,
      tech: ["Python", "LLM", "RAG"],
      lead: "Build Squad A",
      d: "Started Jan 2026",
      hl: [
        "Document ingestion pipeline working",
        "Pilot with one department",
        "Next: feedback round and accuracy testing",
      ],
      r: "",
    },
    {
      k: "on",
      type: "Project",
      t: "Smart Attendance Vision",
      x: "Computer-vision attendance for classrooms, built to respect privacy.",
      l: "Exploring on-device face matching so attendance takes seconds, with a focus on consent, accuracy and keeping data local.",
      st: 1,
      p: 40,
      tech: ["OpenCV", "PyTorch"],
      lead: "Build Squad B",
      d: "Started Feb 2026",
      hl: ["Prototype recognises enrolled faces", "Privacy review in progress"],
      r: "",
    },
    {
      k: "on",
      type: "Research",
      t: "Language AI for Local Dialects",
      x: "Studying how well language models handle regional Indian languages and dialects.",
      l: "A research track measuring where current language models fail on regional dialects, and which small datasets help most.",
      st: 0,
      p: 18,
      tech: ["NLP", "Datasets"],
      lead: "Research Cell",
      d: "Started Mar 2026",
      hl: ["Literature review underway", "Building a small evaluation set"],
      r: "",
    },
    {
      k: "done",
      type: "Project",
      t: "Problem Bank v1",
      x: "The club's open list of real problems from campus, faculty and industry.",
      l: "A searchable list of problems that members can pick up, which became the starting point for every build squad.",
      tech: ["React", "Firebase"],
      lead: "Core Team",
      d: "Completed 2026",
      hl: ["Live and used by build squads", "Feeds the Innovation Challenge"],
      r: "",
    },
    {
      k: "done",
      type: "Project",
      t: "Study Notes Summariser",
      x: "Turns lecture notes into short revision summaries.",
      l: "A small tool that condenses long notes into key points and quick-revision cards for exam time.",
      tech: ["Transformers", "Python"],
      lead: "Build Squad C",
      d: "Completed 2026",
      hl: ["Demoed at Demo Day", "Used by early testers"],
      r: "",
    },
    {
      k: "done",
      type: "Research",
      t: "Bias in Campus Datasets",
      x: "A study of hidden bias in the small datasets student projects rely on.",
      l: "A short research study that checked common student datasets for imbalance and documented simple fixes.",
      tech: ["Statistics", "Research"],
      lead: "Research Cell",
      d: "Completed 2026",
      hl: ["Findings written up", "Checklist shared with squads"],
      r: "",
    },
  ],
};
