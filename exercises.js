function norm(s){ return (s ?? "").toString().trim().toLowerCase(); }
function makeExercise({ name, categories = [], equipment = [], muscles = [] }) {
  return {
    name: String(name).trim(),
    categories: categories.map(norm),
    equipment: equipment.map(norm),
    muscles: muscles.map(norm)
  };
}
/* Condensed exercise library (each exercise appears ONCE). */
const exercisesData = [
  // HINGE / POSTERIOR
   makeExercises({
    name: "Romanian Deadlift",
    categories: ["hinge", "lower body", "glutes", "hamstrings"],
    equipment: ["barbell", "dumbbell", "kettlebell", "cable machine"],
    muscles: ["Hamstrings", "Glute Max", "Lower Back"]
  }),
  makeExercises({
    name: "Conventional Deadlift",
    categories: ["hinge", "lower body", "glutes", "hamstrings", "pull"],
    equipment: ["barbell", "dumbbell"],
    muscles: ["Hamstrings", "Glute Max", "Lower Back", "Traps"]
  }),
  makeExercises({
    name: "Good Morning",
    categories: ["hinge", "lower body", "hamstrings", "glutes"],
    equipment: ["barbell", "dumbbell"],
    muscles: ["Hamstrings", "Glute Max", "Lower Back"]
  }),
  makeExercises({
    name: "Hip Thrust",
    categories: ["hinge", "lower body", "glutes"],
    equipment: ["barbell", "dumbbell", "machine", "cable machine"],
    muscles: ["Glute Max", "Hamstrings"]
  }),
  makeExercises({
    name: "Glute Bridge",
    sections: ["hinge", "lower body", "glutes"],
    equipment: ["barbell", "dumbbell", "body weight"],
    muscles: ["Glute Max", "Hamstrings"]
  }),

  // SQUAT
  makeExercises({
    name: "Back Squat",
    categories: ["squat", "lower body", "quads", "glutes"],
    equipment: ["barbell"],
    muscles: ["Quads", "Glute Max", "Hamstrings"]
  }),
  makeExercises({
    name: "Front Squat",
    sections: ["squat", "lower body", "quads"],
    equipment: ["barbell", "kettlebell"],
    muscles: ["Quads", "Glute Max", "Core"]
  }),
  makeExercises({
    name: "Goblet Squat",
    sections: ["squat", "lower body", "quads"],
    equipment: ["dumbbell", "kettlebell"],
    muscles: ["Quads", "Glute Max"]
  }),
  makeExercises({
    name: "Bulgarian Split Squat",
    sections: ["squat", "lower body", "single-leg", "quads", "glutes"],
    equipment: ["dumbbell", "barbell", "body weight"],
    muscles: ["Quads", "Glute Max", "Hamstrings"]
  }),
  makeExercises({ // Machines
    name: "Leg Press",
    sections: ["squat", "lower body", "quads"],
    equipment: ["machine"],
    muscles: ["Quads", "Glute Max"]
  }),
  makeExercises({
    name: "Hack Squat",
    sections: ["squat", "lower body", "quads"],
    equipment: ["machine", "barbell"],
    muscles: ["Quads", "Glute Max"]
  }),
  makeExercises({
    name: "Reverse Lunges",
    sections: ["squat", "lower body", "full body"],
    equipment: ["machine", "barbell", "dumbbell", "bodyweight", "kettlebell", "resistance bands"],
    muscles: ["Quads", "Glute Max"]
  }),
  
  // PUSH
  makeExercises({
    name: "Bench Press",
    categories: ["push", "upper body", "chest"],
    equipment: ["barbell", "dumbbell", "machine"],
    muscles: ["Chest", "Triceps", "Front Delts"]
  }),
  makeExercises({
    name: "Incline Press",
    sections: ["push", "upper body", "chest"],
    equipment: ["barbell", "dumbbell", "machine", "cable machine"],
    muscles: ["Upper Chest", "Front Delts", "Triceps"]
  }),
  makeExercises({
    name: "Overhead Press",
    sections: ["push", "upper body", "shoulders"],
    equipment: ["barbell", "dumbbell", "machine"],
    muscles: ["Front Delts", "Mid Delts", "Triceps"]
  }),
  makeExercises({
    name: "Push-up",
    sections: ["push", "upper body", "chest"],
    equipment: ["body weight"],
    muscles: ["Chest", "Triceps", "Front Delts"]
  }),
  makeExercises({
    name: "Dips",
    sections: ["push", "upper body", "chest", "triceps"],
    equipment: ["body weight", "machine"],
    muscles: ["Triceps", "Chest", "Front Delts"]
  }),
  makeExercises({
    name: "Chest Fly",
    sections: ["push", "upper body", "chest", "specific muscle"],
    equipment: ["dumbbell", "cable machine", "machine"],
    muscles: ["Chest"]
  }),
  makeExercises({
    name: "Lateral Raise",
    sections: ["push", "upper body", "shoulders", "specific muscle"],
    equipment: ["dumbbell", "cable machine"],
    muscles: ["Mid Delts"]
  }),
  makeExercises({
    name: "Triceps Extension",
    sections: ["push", "upper body", "triceps", "specific muscle"],
    equipment: ["dumbbell", "cable machine", "machine", "barbell"],
    muscles: ["Triceps"]
  }),

  // PULL
  makeExercises({
    name: "Bent-Over Row",
    categories: ["pull", "upper body", "back"],
    equipment: ["barbell", "dumbbell"],
    muscles: ["Lats", "Upper Back", "Biceps"]
  }),
  makeExercises({
    name: "Seated Row",
    sections: ["pull", "upper body", "back"],
    equipment: ["cable machine", "machine"],
    muscles: ["Lats", "Upper Back", "Biceps"]
  }),
  makeExercises({
    name: "Lat Pulldown",
    sections: ["pull", "upper body", "back"],
    equipment: ["cable machine", "machine"],
    muscles: ["Lats", "Biceps", "Upper Back"]
  }),
  makeExercises({
    name: "Pull-up",
    sections: ["pull", "upper body", "back"],
    equipment: ["body weight", "machine"],
    muscles: ["Lats", "Biceps", "Upper Back"]
  }),
  makeExercises({
    name: "Face Pull",
    sections: ["pull", "upper body", "rear delts", "specific muscle"],
    equipment: ["cable machine"],
    muscles: ["Rear Delts", "Upper Back"]
  }),
  makeExercises({
    name: "Biceps Curl",
    sections: ["pull", "upper body", "biceps", "specific muscle"],
    equipment: ["dumbbell", "barbell", "cable machine", "machine"],
    muscles: ["Biceps", "Forearms"]
  }),
  makeExercises({
    name: "Hammer Curl",
    sections: ["pull", "upper body", "biceps", "specific muscle"],
    equipment: ["dumbbell", "cable machine"],
    muscles: ["Biceps", "Forearms"]
  }),
  makeExercises({
    name: "Reverse Fly",
    sections: ["pull", "upper body", "rear delts", "specific muscle"],
    equipment: ["dumbbell", "cable machine", "machine"],
    muscles: ["Rear Delts", "Upper Back"]
  }),

  // LOWER-LEG / ISOLATION
  makeExercises({
    name: "Leg Extension",
    categories: ["lower body", "quads", "specific muscle"],
    equipment: ["machine"],
    muscles: ["Quads"]
  }),
  makeExercises({
    name: "Leg Curl",
    sections: ["lower body", "hamstrings", "specific muscle"],
    equipment: ["machine"],
    muscles: ["Hamstrings"]
  }),
  makeExercises({
    name: "Calf Raise",
    sections: ["lower body", "calves", "specific muscle"],
    equipment: ["machine", "smith machine", "barbell", "dumbbell", "body weight"],
    muscles: ["Calves"]
  }),

  // CORE / FULL BODY
  makeExercises({
    name: "Plank",
    categories: ["core", "full body", "body weight"],
    equipment: ["body weight"],
    muscles: ["Abs", "Obliques", "Lower Back"]
  }),
  makeExercises({
    name: "Cable Wood Chop",
    sections: ["core", "full body"],
    equipment: ["cable machine"],
    muscles: ["Abs", "Obliques"]
  }),
  makeExercises({
    name: "Burpee",
    sections: ["full body", "conditioning"],
    equipment: ["body weight"],
    muscles: ["Full Body"]
  }),
  makeExercises({
    name: "Kettlebell Swing",
    sections: ["hinge", "full body", "glutes", "conditioning"],
    equipment: ["kettlebell"],
    muscles: ["Glute Max", "Hamstrings", "Lower Back"]
  })
];
// Export globally for script.js
window.exercisesData = exercisesData;
