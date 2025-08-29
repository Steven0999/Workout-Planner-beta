(function () {
  const App = (window.App = window.App || {});
  const { title } = App.utils;

  /* Condensed exercise library — each exercise appears once.
     sections = training categories/tags (NOT raw muscles list).
     equipment = supported equipment for that exercise.
     muscles = display only (not used to pollute categories). */
  const EXERCISES = [
    // HINGE / POSTERIOR
    {
      name: "Romanian Deadlift",
      sections: ["hinge", "lower body", "glutes", "hamstrings"],
      equipment: ["barbell", "dumbbell", "kettlebell", "cable machine"],
      muscles: ["Hamstrings", "Glute Max", "Lower Back"]
    },
    {
      name: "Conventional Deadlift",
      sections: ["hinge", "lower body", "glutes", "hamstrings", "pull"],
      equipment: ["barbell", "dumbbell"],
      muscles: ["Hamstrings", "Glute Max", "Lower Back", "Traps"]
    },
    {
      name: "Good Morning",
      sections: ["hinge", "lower body", "hamstrings", "glutes"],
      equipment: ["barbell", "dumbbell"],
      muscles: ["Hamstrings", "Glute Max", "Lower Back"]
    },
    {
      name: "Hip Thrust",
      sections: ["hinge", "lower body", "glutes"],
      equipment: ["barbell", "dumbbell", "machine", "cable machine"],
      muscles: ["Glute Max", "Hamstrings"]
    },
    {
      name: "Glute Bridge",
      sections: ["hinge", "lower body", "glutes"],
      equipment: ["barbell", "dumbbell", "body weight"],
      muscles: ["Glute Max", "Hamstrings"]
    },

    // SQUAT
    {
      name: "Back Squat",
      sections: ["squat", "lower body", "quads", "glutes"],
      equipment: ["barbell"],
      muscles: ["Quads", "Glute Max", "Hamstrings"]
    },
    {
      name: "Front Squat",
      sections: ["squat", "lower body", "quads"],
      equipment: ["barbell", "kettlebell"],
      muscles: ["Quads", "Glute Max", "Core"]
    },
    {
      name: "Goblet Squat",
      sections: ["squat", "lower body", "quads"],
      equipment: ["dumbbell", "kettlebell"],
      muscles: ["Quads", "Glute Max"]
    },
    {
      name: "Bulgarian Split Squat",
      sections: ["squat", "lower body", "single-leg", "quads", "glutes"],
      equipment: ["dumbbell", "barbell", "body weight"],
      muscles: ["Quads", "Glute Max", "Hamstrings"]
    },
    { // Machines
      name: "Leg Press",
      sections: ["squat", "lower body", "quads"],
      equipment: ["machine"],
      muscles: ["Quads", "Glute Max"]
    },
    {
      name: "Hack Squat",
      sections: ["squat", "lower body", "quads"],
      equipment: ["machine", "barbell"],
      muscles: ["Quads", "Glute Max"]
    },

    // PUSH
    {
      name: "Bench Press",
      sections: ["push", "upper body", "chest"],
      equipment: ["barbell", "dumbbell", "machine"],
      muscles: ["Chest", "Triceps", "Front Delts"]
    },
    {
      name: "Incline Press",
      sections: ["push", "upper body", "chest"],
      equipment: ["barbell", "dumbbell", "machine", "cable machine"],
      muscles: ["Upper Chest", "Front Delts", "Triceps"]
    },
    {
      name: "Overhead Press",
      sections: ["push", "upper body", "shoulders"],
      equipment: ["barbell", "dumbbell", "machine"],
      muscles: ["Front Delts", "Mid Delts", "Triceps"]
    },
    {
      name: "Push-up",
      sections: ["push", "upper body", "chest"],
      equipment: ["body weight"],
      muscles: ["Chest", "Triceps", "Front Delts"]
    },
    {
      name: "Dips",
      sections: ["push", "upper body", "chest", "triceps"],
      equipment: ["body weight", "machine"],
      muscles: ["Triceps", "Chest", "Front Delts"]
    },
    {
      name: "Chest Fly",
      sections: ["push", "upper body", "chest", "specific muscle"],
      equipment: ["dumbbell", "cable machine", "machine"],
      muscles: ["Chest"]
    },
    {
      name: "Lateral Raise",
      sections: ["push", "upper body", "shoulders", "specific muscle"],
      equipment: ["dumbbell", "cable machine"],
      muscles: ["Mid Delts"]
    },
    {
      name: "Triceps Extension",
      sections: ["push", "upper body", "triceps", "specific muscle"],
      equipment: ["dumbbell", "cable machine", "machine", "barbell"],
      muscles: ["Triceps"]
    },

    // PULL
    {
      name: "Bent-Over Row",
      sections: ["pull", "upper body", "back"],
      equipment: ["barbell", "dumbbell"],
      muscles: ["Lats", "Upper Back", "Biceps"]
    },
    {
      name: "Seated Row",
      sections: ["pull", "upper body", "back"],
      equipment: ["cable machine", "machine"],
      muscles: ["Lats", "Upper Back", "Biceps"]
    },
    {
      name: "Lat Pulldown",
      sections: ["pull", "upper body", "back"],
      equipment: ["cable machine", "machine"],
      muscles: ["Lats", "Biceps", "Upper Back"]
    },
    {
      name: "Pull-up",
      sections: ["pull", "upper body", "back"],
      equipment: ["body weight", "machine"],
      muscles: ["Lats", "Biceps", "Upper Back"]
    },
    {
      name: "Face Pull",
      sections: ["pull", "upper body", "rear delts", "specific muscle"],
      equipment: ["cable machine"],
      muscles: ["Rear Delts", "Upper Back"]
    },
    {
      name: "Biceps Curl",
      sections: ["pull", "upper body", "biceps", "specific muscle"],
      equipment: ["dumbbell", "barbell", "cable machine", "machine"],
      muscles: ["Biceps", "Forearms"]
    },
    {
      name: "Hammer Curl",
      sections: ["pull", "upper body", "biceps", "specific muscle"],
      equipment: ["dumbbell", "cable machine"],
      muscles: ["Biceps", "Forearms"]
    },
    {
      name: "Reverse Fly",
      sections: ["pull", "upper body", "rear delts", "specific muscle"],
      equipment: ["dumbbell", "cable machine", "machine"],
      muscles: ["Rear Delts", "Upper Back"]
    },

    // LOWER-LEG / ISOLATION
    {
      name: "Leg Extension",
      sections: ["lower body", "quads", "specific muscle"],
      equipment: ["machine"],
      muscles: ["Quads"]
    },
    {
      name: "Leg Curl",
      sections: ["lower body", "hamstrings", "specific muscle"],
      equipment: ["machine"],
      muscles: ["Hamstrings"]
    },
    {
      name: "Calf Raise",
      sections: ["lower body", "calves", "specific muscle"],
      equipment: ["machine", "smith machine", "barbell", "dumbbell", "body weight"],
      muscles: ["Calves"]
    },

    // CORE / FULL BODY
    {
      name: "Plank",
      sections: ["core", "full body", "body weight"],
      equipment: ["body weight"],
      muscles: ["Abs", "Obliques", "Lower Back"]
    },
    {
      name: "Cable Wood Chop",
      sections: ["core", "full body"],
      equipment: ["cable machine"],
      muscles: ["Abs", "Obliques"]
    },
    {
      name: "Burpee",
      sections: ["full body", "conditioning"],
      equipment: ["body weight"],
      muscles: ["Full Body"]
    },
    {
      name: "Kettlebell Swing",
      sections: ["hinge", "full body", "glutes", "conditioning"],
      equipment: ["kettlebell"],
      muscles: ["Glute Max", "Hamstrings", "Lower Back"]
    }
  ];

  // Normalize
  const NORM = EXERCISES.map((e) => ({
    name: e.name,
    sections: (e.sections || []).map((s) => String(s).trim().toLowerCase()),
    equipment: (e.equipment || []).map((x) => String(x).trim().toLowerCase()),
    muscles: (e.muscles || []).slice()
  }));

  // Allowed top-level categories (what the user selects)
  const CATEGORY_ALLOW = new Set([
    "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle"
  ]);

  // Helpers
  const uniq = (a) => [...new Set(a)];
  const allCategories = () =>
    uniq(NORM.flatMap((e) => e.sections.filter((s) => CATEGORY_ALLOW.has(s)))).sort();
  const allMuscles = () => uniq(NORM.flatMap((e) => e.muscles)).sort();

  function byLocation(items, loc) {
    if (loc !== "home") return items;
    const HOME = new Set(["body weight", "resistance bands", "kettlebell"]);
    return items.filter((e) => e.equipment.some((eq) => HOME.has(eq)));
  }
  function byCategoryAndMuscle(items, category, muscle) {
    const cat = (category || "").toLowerCase().trim();
    if (!cat) return [];
    if (cat === "upper") return items.filter((e) => e.sections.includes("upper body"));
    if (cat === "lower" || cat === "legs") return items.filter((e) => e.sections.includes("lower body"));

    if (cat === "specific muscle") {
      if (!muscle) return [];
      return items.filter(
        (e) => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle)
      );
    }
    return items.filter((e) => e.sections.includes(cat));
  }

  App.data = {
    EXERCISES_RAW: EXERCISES,
    EXERCISES: NORM,
    CATEGORY_ALLOW,
    allCategories,
    allMuscles,
    byLocation,
    byCategoryAndMuscle
  };
})();
