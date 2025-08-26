// --- Comprehensive Exercise Data ---
const exercisesData = [
  // Upper Body - Barbell
  { name: "Barbell Bench Press", category: "upper body", equipment: "barbell" },
  { name: "Barbell Shoulder Press", category: "upper body", equipment: "barbell" },
  { name: "Barbell Bent-Over Row", category: "upper body", equipment: "barbell" },
  { name: "Barbell Bicep Curl", category: "upper body", equipment: "barbell" },
  { name: "Barbell Skull Crusher", category: "upper body", equipment: "barbell" },
  { name: "Barbell Upright Row", category: "upper body", equipment: "barbell" },
  { name: "Barbell Shrugs", category: "upper body", equipment: "barbell" },
  { name: "Barbell JM Press", category: "upper body", equipment: "barbell" },
  { name: "Barbell Landmine Press", category: "upper body", equipment: "barbell" },
  { name: "Barbell High Pull", category: "upper body", equipment: "barbell" },
  { name: "Barbell Incline Bench Press", category: "upper body", equipment: "barbell" },

  
  // Upper Body - Dumbbell
  { name: "Dumbbell Bench Press", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Incline Press", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Overhead Press (Standing)", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Overhead Press (Seated)", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Flys", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Lateral Raise", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Front Raise", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Arnold Press", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Bicep Curl", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Hammer Curl", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Tricep Extension", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Kickbacks", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Rows", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Pullover", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Shrugs", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Reverse Fly", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell W-Raise", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Zottman Curl", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Waiter's Carry", category: "upper body", equipment: "dumbbell" },
  { name: "Dumbbell Around the World", category: "upper body", equipment: "dumbbell" },

  // Upper Body - Cable Machine
  { name: "Cable Chest Fly", category: "upper body", equipment: "cable machine" },
  { name: "Cable Crossover", category: "upper body", equipment: "cable machine" },
  { name: "Cable Lateral Raise", category: "upper body", equipment: "cable machine" },
  { name: "Cable Face Pull", category: "upper body", equipment: "cable machine" },
  { name: "Cable Pullover", category: "upper body", equipment: "cable machine" },
  { name: "Cable Upright Row", category: "upper body", equipment: "cable machine" },
  { name: "Cable Bicep Curl", category: "upper body", equipment: "cable machine" },
  { name: "Cable Hammer Curl", category: "upper body", equipment: "cable machine" },
  { name: "Cable Tricep Pushdown", category: "upper body", equipment: "cable machine" },
  { name: "Cable Rope Pushdown", category: "upper body", equipment: "cable machine" },
  { name: "Cable Seated Row", category: "upper body", equipment: "cable machine" },
  { name: "Cable High Row", category: "upper body", equipment: "cable machine" },
  { name: "Cable Lat Pulldown", category: "upper body", equipment: "cable machine" },
  { name: "Cable Reverse Fly", category: "upper body", equipment: "cable machine" },
  { name: "Cable Pec Deck Fly", category: "upper body", equipment: "cable machine" },
  { name: "Cable Wood Chop", category: "upper body", equipment: "cable machine" },
  { name: "Cable Decline Press", category: "upper body", equipment: "cable machine" },
  { name: "Cable Seated Tricep Extension", category: "upper body", equipment: "cable machine" },
  { name: "Cable Standing Tricep Extension", category: "upper body", equipment: "cable machine" },
  { name: "Cable Landmine Press", category: "upper body", equipment: "cable machine" },

  // Upper Body - Machine
  { name: "Machine Chest Press", category: "upper body", equipment: "machine" },
  { name: "Machine Shoulder Press", category: "upper body", equipment: "machine" },
  { name: "Machine Pec Deck", category: "upper body", equipment: "machine" },
  { name: "Machine Lat Pulldown", category: "upper body", equipment: "machine" },
  { name: "Machine Seated Row", category: "upper body", equipment: "machine" },
  { name: "Machine Bicep Curl", category: "upper body", equipment: "machine" },
  { name: "Machine Tricep Extension", category: "upper body", equipment: "machine" },
  { name: "Assisted Pull-ups", category: "upper body", equipment: "machine" },
  { name: "Assisted Dips", category: "upper body", equipment: "machine" },
  { name: "Machine Reverse Fly", category: "upper body", equipment: "machine" },
  
  // Home Workout Exercises
  { name: "Push-ups", category: "upper body", equipment: "body weight" },
  { name: "Pull-ups (Home)", category: "upper body", equipment: "body weight" },
  { name: "Dips (Home)", category: "upper body", equipment: "body weight" },
  { name: "Inverted Rows", category: "upper body", equipment: "body weight" },
  { name: "Resistance Band Chest Press", category: "upper body", equipment: "resistance bands" },
  { name: "Resistance Band Rows", category: "upper body", equipment: "resistance bands" },
  { name: "Resistance Band Bicep Curls", category: "upper body", equipment: "resistance bands" },
  { name: "Kettlebell Swings", category: "upper body", equipment: "kettlebell" },
  { name: "Kettlebell Overhead Press", category: "upper body", equipment: "kettlebell" },

  // Lower Body - Barbell
  { name: "Barbell Back Squat", category: "lower body", equipment: "barbell" },
  { name: "Barbell Front Squat", category: "lower body", equipment: "barbell" },
  { name: "Barbell Forward Lunges", category: "lower body", equipment: "barbell" },
  { name: "Barbell Romanian Deadlift", category: "lower body", equipment: "barbell" },
  { name: "Barbell Good Mornings", category: "lower body", equipment: "barbell" },
  { name: "Barbell Glute Bridge", category: "lower body", equipment: "barbell" },
  { name: "Barbell Hip Thrust", category: "lower body", equipment: "barbell" },
  { name: "Barbell Calf Raises", category: "lower body", equipment: "barbell" },
  { name: "Barbell Sumo Squat", category: "lower body", equipment: "barbell" },
  { name: "Barbell Deadlift", category: "lower body", equipment: "barbell" },
  { name: "Barbell Reverse Lunges", category: "lower body", equipment: "barbell" },
  { name: "Barbell Split Squats", category: "lower body", equipment: "barbell" },
  { name: "Barbell Bulgarian Split Squats", category: "lower body", equipment: "barbell" },
  
  // Lower Body - Dumbbell
  { name: "Dumbbell Lunges", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Goblet Squat", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Step-ups", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Romanian Deadlift", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Bulgarian Split Squat", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Calf Raises", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Jump Squats", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Single Leg Deadlift", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Reverse Lunges", category: "lower body", equipment: "dumbbell" },
  { name: "Dumbbell Box Squats", category: "lower body", equipment: "dumbbell" },

  // Lower Body - Machine
  { name: "Machine Leg Press", category: "lower body", equipment: "machine" },
  { name: "Machine Hack Squat", category: "lower body", equipment: "machine" },
  { name: "Machine Leg Extension", category: "lower body", equipment: "machine" },
  { name: "Machine Leg Curl (Seated)", category: "lower body", equipment: "machine" },
  { name: "Machine Leg Curl (Lying)", category: "lower body", equipment: "machine" },
  { name: "Machine Calf Raise (Seated)", category: "lower body", equipment: "machine" },
  { name: "Machine Calf Raise (Standing)", category: "lower body", equipment: "machine" },
  { name: "Machine Hip Abduction", category: "lower body", equipment: "machine" },
  { name: "Machine Hip Adduction", category: "lower body", equipment: "machine" },
  { name: "Smith Machine Squat", category: "lower body", equipment: "machine" },

  // Home Lower Body Exercises
  { name: "Squats (Body Weight)", category: "lower body", equipment: "body weight" },
  { name: "Lunges (Body Weight)", category: "lower body", equipment: "body weight" },
  { name: "Glute Bridges", category: "lower body", equipment: "body weight" },
  { name: "Calf Raises", category: "lower body", equipment: "body weight" },
  { name: "Resistance Band Squats", category: "lower body", equipment: "resistance bands" },
  { name: "Resistance Band Hip Thrusts", category: "lower body", equipment: "resistance bands" },
  { name: "Kettlebell Goblet Squat", category: "lower body", equipment: "kettlebell" },
  { name: "Kettlebell Deadlift", category: "lower body", equipment: "kettlebell" },

  // Push - Barbell
  { name: "Barbell Bench Press", category: "push", equipment: "barbell" },
  { name: "Barbell Incline Press", category: "push", equipment: "barbell" },
  { name: "Barbell Decline Press", category: "push", equipment: "barbell" },
  { name: "Barbell Floor Press", category: "push", equipment: "barbell" },
  { name: "Barbell Overhead Press", category: "push", equipment: "barbell" },
  { name: "Barbell Push Press", category: "push", equipment: "barbell" },
  { name: "Barbell Close Grip Bench Press", category: "push", equipment: "barbell" },
  { name: "Barbell Military Press", category: "push", equipment: "barbell" },
  { name: "Barbell Landmine Press", category: "push", equipment: "barbell" },
  { name: "Barbell Bradford Press", category: "push", equipment: "barbell" },

  // Push - Dumbbell
  { name: "Dumbbell Bench Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Incline Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Decline Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Arnold Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Overhead Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Skull Crushers", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Tricep Extension", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Close Grip Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Squeeze Press", category: "push", equipment: "dumbbell" },
  { name: "Dumbbell Push Press", category: "push", equipment: "dumbbell" },

  // Push - Cable Machine
  { name: "Cable Chest Press", category: "push", equipment: "cable machine" },
  { name: "Cable Incline Press", category: "push", equipment: "cable machine" },
  { name: "Cable Tricep Pushdown", category: "push", equipment: "cable machine" },
  { name: "Cable Overhead Tricep Extension", category: "push", equipment: "cable machine" },
  { name: "Cable Crossover", category: "push", equipment: "cable machine" },
  { name: "Cable One-Arm Press", category: "push", equipment: "cable machine" },
  { name: "Cable Shoulder Press", category: "push", equipment: "cable machine" },
  { name: "Cable Pec Deck Fly", category: "push", equipment: "cable machine" },
  { name: "Cable Bent-Over Tricep Extension", category: "push", equipment: "cable machine" },
  { name: "Cable Front Raise", category: "push", equipment: "cable machine" },
  
  // Home Push Exercises
  { name: "Push-ups", category: "push", equipment: "body weight" },
  { name: "Incline Push-ups", category: "push", equipment: "body weight" },
  { name: "Resistance Band Chest Press", category: "push", equipment: "resistance bands" },
  { name: "Resistance Band Overhead Press", category: "push", equipment: "resistance bands" },
  { name: "Kettlebell Floor Press", category: "push", equipment: "kettlebell" },

  // Pull - Barbell
  { name: "Barbell Deadlift", category: "pull", equipment: "barbell" },
  { name: "Barbell Bent-Over Row", category: "pull", equipment: "barbell" },
  { name: "Barbell T-Bar Row", category: "pull", equipment: "barbell" },
  { name: "Barbell Bicep Curl", category: "pull", equipment: "barbell" },
  { name: "Barbell Good Mornings", category: "pull", equipment: "barbell" },
  { name: "Barbell Power Clean", category: "pull", equipment: "barbell" },
  { name: "Barbell Snatch", category: "pull", equipment: "barbell" },
  { name: "Barbell Pendlay Row", category: "pull", equipment: "barbell" },
  { name: "Barbell Reverse Curl", category: "pull", equipment: "barbell" },
  { name: "Barbell Rack Pull", category: "pull", equipment: "barbell" },

  // Pull - Dumbbell
  { name: "Dumbbell Rows", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Bicep Curl", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Hammer Curl", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Farmer's Walk", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Pullover", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Shrugs", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Zottman Curl", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Reverse Fly", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Upright Row", category: "pull", equipment: "dumbbell" },
  { name: "Dumbbell Deadlift", category: "pull", equipment: "dumbbell" },

  // Pull - Cable Machine
  { name: "Cable Pullover", category: "pull", equipment: "cable machine" },
  { name: "Cable Seated Row", category: "pull", equipment: "cable machine" },
  { name: "Cable Lat Pulldown (Wide Grip)", category: "pull", equipment: "cable machine" },
  { name: "Cable Lat Pulldown (Close Grip)", category: "pull", equipment: "cable machine" },
  { name: "Cable Bicep Curl", category: "pull", equipment: "cable machine" },
  { name: "Cable Face Pull", category: "pull", equipment: "cable machine" },
  { name: "Cable Straight-Arm Pulldown", category: "pull", equipment: "cable machine" },
  { name: "Cable Rope Hammer Curl", category: "pull", equipment: "cable machine" },
  { name: "Cable High Row", category: "pull", equipment: "cable machine" },
  { name: "Cable T-Bar Row", category: "pull", equipment: "cable machine" },
  
  // Home Pull Exercises
  { name: "Pull-ups (Home)", category: "pull", equipment: "body weight" },
  { name: "Inverted Rows", category: "pull", equipment: "body weight" },
  { name: "Resistance Band Rows", category: "pull", equipment: "resistance bands" },
  { name: "Resistance Band Pull-aparts", category: "pull", equipment: "resistance bands" },
  { name: "Kettlebell Bent-Over Row", category: "pull", equipment: "kettlebell" },

  // Hinge - Barbell
  { name: "Barbell Deadlift", category: "hinge", equipment: "barbell" },
  { name: "Barbell Romanian Deadlift", category: "hinge", equipment: "barbell" },
  { name: "Barbell Good Mornings", category: "hinge", equipment: "barbell" },
  { name: "Barbell Stiff-Legged Deadlift", category: "hinge", equipment: "barbell" },
  { name: "Barbell Sumo Deadlift", category: "hinge", equipment: "barbell" },
  { name: "Barbell Glute Bridge", category: "hinge", equipment: "barbell" },
  { name: "Barbell Hip Thrust", category: "hinge", equipment: "barbell" },
  { name: "Barbell Rack Pull", category: "hinge", equipment: "barbell" },
  { name: "Barbell Snatch Grip Deadlift", category: "hinge", equipment: "barbell" },
  { name: "Barbell Jefferson Deadlift", category: "hinge", equipment: "barbell" },
  
  // Hinge - Dumbbell
  { name: "Dumbbell Romanian Deadlift", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Single-Leg Deadlift", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Glute Bridge", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Stiff-Legged Deadlift", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Hip Thrust", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Sumo Deadlift", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Good Mornings", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Farmer's Walk", category: "hinge", equipment: "dumbbell" },
  { name: "Dumbbell Power Clean", category: "hinge", equipment: "dumbbell" },
  { name: "Kettlebell Swing", category: "hinge", equipment: "kettlebell" },

  // Squat - Barbell
  { name: "Barbell Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Front Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Box Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Zercher Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Overhead Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Hack Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Sumo Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Pause Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Belt Squat", category: "squat", equipment: "barbell" },
  { name: "Barbell Pin Squat", category: "squat", equipment: "barbell" },

  // Squat - Dumbbell
  { name: "Dumbbell Goblet Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Sumo Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Box Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Thrusters", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Pistol Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Jump Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Split Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Lateral Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Wall Squat", category: "squat", equipment: "dumbbell" },
  { name: "Dumbbell Overhead Squat", category: "squat", equipment: "dumbbell" },

  // Home Squat Exercises
  { name: "Bodyweight Squats", category: "squat", equipment: "body weight" },
  { name: "Bulgarian Split Squats (Body Weight)", category: "squat", equipment: "body weight" },
  { name: "Pistol Squats (Body Weight)", category: "squat", equipment: "body weight" },
  { name: "Resistance Band Goblet Squat", category: "squat", equipment: "resistance bands" },
  { name: "Kettlebell Goblet Squat", category: "squat", equipment: "kettlebell" },
  { name: "Kettlebell Front Squat", category: "squat", equipment: "kettlebell" },

  // Full Body - Barbell
  { name: "Barbell Clean and Jerk", category: "full body", equipment: "barbell" },
  { name: "Barbell Snatch", category: "full body", equipment: "barbell" },
  { name: "Barbell Thrusters", category: "full body", equipment: "barbell" },
  { name: "Barbell Power Clean", category: "full body", equipment: "barbell" },
  { name: "Barbell Squat Clean", category: "full body", equipment: "barbell" },
  { name: "Barbell Hang Clean", category: "full body", equipment: "barbell" },
  { name: "Barbell Zercher Squat", category: "full body", equipment: "barbell" },
  { name: "Barbell Good Mornings", category: "full body", equipment: "barbell" },
  { name: "Barbell Renegade Row", category: "full body", equipment: "barbell" },
  { name: "Barbell Push Press", category: "full body", equipment: "barbell" },

  // Full Body - Dumbbell
  { name: "Dumbbell Thrusters", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Snatch", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Clean and Press", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Devil's Press", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Renegade Row", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Man-Maker", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Push Press", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Squat and Press", category: "full body", equipment: "dumbbell" },
  { name: "Dumbbell Power Clean", category: "full body", equipment: "dumbbell" },
  { name: "Kettlebell Swing", category: "full body", equipment: "kettlebell" },

  // Home Full Body Exercises
  { name: "Burpees", category: "full body", equipment: "body weight" },
  { name: "Jumping Jacks", category: "full body", equipment: "body weight" },
  { name: "Mountain Climbers", category: "full body", equipment: "body weight" },
  { name: "Kettlebell Swings", category: "full body", equipment: "kettlebell" },
  { name: "Kettlebell Clean and Press", category: "full body", equipment: "kettlebell" },

  // Specific Muscle - Barbell
  { name: "Barbell Bench Press (Chest)", category: "specific muscle", equipment: "barbell", muscle: "Chest" },
  { name: "Barbell Close-Grip Bench Press (Triceps)", category: "specific muscle", equipment: "barbell", muscle: "Triceps" },
  { name: "Barbell Shrugs (Traps)", category: "specific muscle", equipment: "barbell", muscle: "Traps" },
  { name: "Barbell Calf Raises", category: "specific muscle", equipment: "barbell", muscle: "Calves" },
  { name: "Barbell Reverse Curl (Forearms)", category: "specific muscle", equipment: "barbell", muscle: "Biceps" },
  { name: "Barbell Wrist Curls (Forearms)", category: "specific muscle", equipment: "barbell", muscle: "Forearms" },
  { name: "Barbell Standing Calf Raise", category: "specific muscle", equipment: "barbell", muscle: "Calves" },
  { name: "Barbell Drag Curl", category: "specific muscle", equipment: "barbell", muscle: "Biceps" },
  { name: "Barbell Skull Crushers", category: "specific muscle", equipment: "barbell", muscle: "Triceps" },
  { name: "Barbell Hack Squat", category: "specific muscle", equipment: "barbell", muscle: "Quads" },
  { name: "Barbell Hip Thrust", category: "specific muscle", equipment: "barbell", muscle: "Glute Max" },
  { name: "Barbell Overhead Triceps Extensions", category: "specific muscle", equipment: "barbell", muscle: "Triceps" },
  { name: "Barbell Bent Over Row", category: "specific muscle", equipment: "barbell", muscle: "Lats" },


  // Specific Muscle - Dumbbell
  { name: "Dumbbell Bicep Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Biceps" },
  { name: "Dumbbell Hammer Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Biceps" },
  { name: "Dumbbell Concentration Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Biceps" },
  { name: "Dumbbell Tricep Kickbacks", category: "specific muscle", equipment: "dumbbell", muscle: "Triceps" },
  { name: "Dumbbell Lateral Raise", category: "specific muscle", equipment: "dumbbell", muscle: "Mid Delts" },
  { name: "Dumbbell Front Raise", category: "specific muscle", equipment: "dumbbell", muscle: "Front Delts" },
  { name: "Dumbbell Rear Delt Fly", category: "specific muscle", equipment: "dumbbell", muscle: "Rear Delts" },
  { name: "Dumbbell Calf Raises", category: "specific muscle", equipment: "dumbbell", muscle: "Calves" },
  { name: "Dumbbell Shrugs", category: "specific muscle", equipment: "dumbbell", muscle: "Traps" },
  { name: "Dumbbell Wrist Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Forearms" },
  { name: "Dumbbell Chest Fly", category: "specific muscle", equipment: "dumbbell", muscle: "Chest" },
  { name: "Dumbbell Pullover", category: "specific muscle", equipment: "dumbbell", muscle: "Lats" },
  { name: "Dumbbell One-Arm Tricep Extension", category: "specific muscle", equipment: "dumbbell", muscle: "Triceps" },
  { name: "Dumbbell One-Arm Bicep Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Biceps" },
  { name: "Dumbbell Overhead Tricep Extension", category: "specific muscle", equipment: "dumbbell", muscle: "Triceps" },
  { name: "Dumbbell W-Raise", category: "specific muscle", equipment: "dumbbell", muscle: "Mid Delts" },
  { name: "Dumbbell Arnold Press", category: "specific muscle", equipment: "dumbbell", muscle: "Front Delts" },
  { name: "Dumbbell Zottman Curl", category: "specific muscle", equipment: "dumbbell", muscle: "Biceps" },
  { name: "Dumbbell Reverse Fly", category: "specific muscle", equipment: "dumbbell", muscle: "Rear Delts" },
  { name: "Dumbbell Farmer's Walk", category: "specific muscle", equipment: "dumbbell", muscle: "Forearms" },
  
  // Specific Muscle - Cable Machine
  { name: "Cable Bicep Curl", category: "specific muscle", equipment: "cable machine", muscle: "Biceps" },
  { name: "Cable Tricep Pushdown", category: "specific muscle", equipment: "cable machine", muscle: "Triceps" },
  { name: "Cable Overhead Tricep Extension", category: "specific muscle", equipment: "cable machine", muscle: "Triceps" },
  { name: "Cable Face Pull", category: "specific muscle", equipment: "cable machine", muscle: "Upper Back" },
  { name: "Cable Lateral Raise", category: "specific muscle", equipment: "cable machine", muscle: "Mid Delts" },
  { name: "Cable Front Raise", category: "specific muscle", equipment: "cable machine", muscle: "Front Delts" },
  { name: "Cable Reverse Fly", category: "specific muscle", equipment: "cable machine", muscle: "Rear Delts" },
  { name: "Cable Rope Pushdown", category: "specific muscle", equipment: "cable machine", muscle: "Triceps" },
  { name: "Cable Hammer Curl", category: "specific muscle", equipment: "cable machine", muscle: "Biceps" },
  { name: "Cable Pullover", category: "specific muscle", equipment: "cable machine", muscle: "Lats" },
  { name: "Cable Ab Crunch", category: "specific muscle", equipment: "cable machine", muscle: "Abs" },
  { name: "Cable Wood Chop", category: "specific muscle", equipment: "cable machine", muscle: "Abs" },
  { name: "Cable Oblique Twist", category: "specific muscle", equipment: "cable machine", muscle: "Abs" },
  { name: "Cable Hip Abduction", category: "specific muscle", equipment: "cable machine", muscle: "Glute Med" },
  { name: "Cable Hip Adduction", category: "specific muscle", equipment: "cable machine", muscle: "Glute Med" },
  { name: "Cable Glute Kickback", category: "specific muscle", equipment: "cable machine", muscle: "Glute Max" },
  { name: "Cable Upright Row", category: "specific muscle", equipment: "cable machine", muscle: "Traps" },
  { name: "Cable Tricep Kickback", category: "specific muscle", equipment: "cable machine", muscle: "Triceps" },
  { name: "Cable Drag Curl", category: "specific muscle", equipment: "cable machine", muscle: "Biceps" },
  { name: "Cable Standing Calf Raise", category: "specific muscle", equipment: "cable machine", muscle: "Calves" },

  // Specific Muscle - Machine
  { name: "Machine Leg Extension", category: "specific muscle", equipment: "machine", muscle: "Quads" },
  { name: "Machine Leg Curl", category: "specific muscle", equipment: "machine", muscle: "Hamstrings" },
  { name: "Machine Calf Raise (Seated)", category: "specific muscle", equipment: "machine", muscle: "Calves" },
  { name: "Machine Calf Raise (Standing)", category: "specific muscle", equipment: "machine", muscle: "Calves" },
  { name: "Machine Hip Abduction", category: "specific muscle", equipment: "machine", muscle: "Glute Med" },
  { name: "Machine Hip Adduction", category: "specific muscle", equipment: "machine", muscle: "Glute Med" },
  { name: "Machine Bicep Curl", category: "specific muscle", equipment: "machine", muscle: "Biceps" },
  { name: "Machine Tricep Extension", category: "specific muscle", equipment: "machine", muscle: "Triceps" },
  { name: "Machine Pec Deck", category: "specific muscle", equipment: "machine", muscle: "Chest" },
  { name: "Machine Shoulder Press", category: "specific muscle", equipment: "machine", muscle: "Front Delts" },
  { name: "Machine Reverse Fly", category: "specific muscle", equipment: "machine", muscle: "Rear Delts" },
  { name: "Machine Seated Row", category: "specific muscle", equipment: "machine", muscle: "Upper Back" },
  { name: "Machine Lat Pulldown", category: "specific muscle", equipment: "machine", muscle: "Lats" },
  { name: "Machine Ab Crunch", category: "specific muscle", equipment: "machine", muscle: "Abs" },
  { name: "Machine Back Extension", category: "specific muscle", equipment: "machine", muscle: "Lower Back" },
  { name: "Machine Glute Kickback", category: "specific muscle", equipment: "machine", muscle: "Glute Max" },
  { name: "Smith Machine Squat", category: "specific muscle", equipment: "machine", muscle: "Quads" },
  { name: "Smith Machine Calf Raise", category: "specific muscle", equipment: "machine", muscle: "Calves" },
  { name: "Smith Machine Hip Thrust", category: "specific muscle", equipment: "machine", muscle: "Glute Max" },
  { name: "Smith Machine Bench Press", category: "specific muscle", equipment: "machine", muscle: "Chest" },

  // Specific Muscle - Home
  { name: "Bodyweight Squat (Quads)", category: "specific muscle", equipment: "body weight", muscle: "Quads" },
  { name: "Lunges (Quads/Glutes)", category: "specific muscle", equipment: "body weight", muscle: "Quads" },
  { name: "Push-ups (Chest)", category: "specific muscle", equipment: "body weight", muscle: "Chest" },
  { name: "Inverted Rows (Upper Back)", category: "specific muscle", equipment: "body weight", muscle: "Upper Back" },
  { name: "Bodyweight Calf Raises", category: "specific muscle", equipment: "body weight", muscle: "Calves" },
  { name: "Plank (Abs)", category: "specific muscle", equipment: "body weight", muscle: "Abs" },
  { name: "Bicycle Crunches (Abs)", category: "specific muscle", equipment: "body weight", muscle: "Abs" },
  { name: "Glute Bridges (Glute Max)", category: "specific muscle", equipment: "body weight", muscle: "Glute Max" },
  { name: "Resistance Band Bicep Curls", category: "specific muscle", equipment: "resistance bands", muscle: "Biceps" },
  { name: "Resistance Band Tricep Extensions", category: "specific muscle", equipment: "resistance bands", muscle: "Triceps" },
  { name: "Resistance Band Lateral Raises", category: "specific muscle", equipment: "resistance bands", muscle: "Mid Delts" },
  { name: "Resistance Band Rows", category: "specific muscle", equipment: "resistance bands", muscle: "Upper Back" },
  { name: "Kettlebell Swing", category: "specific muscle", equipment: "kettlebell", muscle: "Glute Max" },
  { name: "Kettlebell Goblet Squat", category: "specific muscle", equipment: "kettlebell", muscle: "Quads" },
  { name: "Kettlebell Overhead Press", category: "specific muscle", equipment: "kettlebell", muscle: "Front Delts" },
  { name: "Kettlebell Romanian Deadlift", category: "specific muscle", equipment: "kettlebell", muscle: "Hamstrings" },
];

// --- State Variables and Initial Setup ---
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let myChart; // Variable to hold the Chart.js instance
let editingRecord = null; // To track if we're in edit mode

document.addEventListener("DOMContentLoaded", () => {
  populateWorkoutTypeDropdown();
  populateWorkOnDropdown();
  populateMuscleDropdown();
  showLoggerView();
  document.getElementById('workout-datetime').value = new Date().toISOString().slice(0, 16);
  renderSetWeightInputs();
});

// --- UI Management ---
function showLoggerView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");
  resetLoggerForm();
}

function showHistoryView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");
  populateHistoryDropdown();
}

// --- Workout Logger Logic ---
function populateWorkoutTypeDropdown() {
  const typeSelect = document.getElementById("workout-type-select");
  typeSelect.innerHTML = `
    <option value="">--Select Location--</option>
    <option value="gym">Gym</option>
    <option value="home">Home</option>
  `;
}

function populateWorkOnDropdown() {
  const workOnSelect = document.getElementById("work-on-select");
  const categories = [...new Set(exercisesData.map(e => e.category))];
  workOnSelect.innerHTML = `<option value="">--Select--</option>` + categories.map(cat => `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`).join('');
}

function populateMuscleDropdown() {
  const muscleSelect = document.getElementById("muscle-select");
  const muscles = [
    "Abs", "Biceps", "Calves", "Chest", "Forearms", "Front Delts", "Glute Max", "Glute Med",
    "Hamstrings", "Lats", "Lower Back", "Mid Delts", "Quads", "Rear Delts", "Traps", "Triceps", "Upper Back"
  ].sort();
  muscleSelect.innerHTML = `<option value="">--Select--</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join('');
}

function filterEquipmentByWorkoutType() {
  const selectedType = document.getElementById("workout-type-select").value;
  const workOnSelect = document.getElementById("work-on-select");
  workOnSelect.value = "";
  filterEquipment();
}

function filterEquipment() {
  const selectedType = document.getElementById("workout-type-select").value;
  const selectedCategory = document.getElementById("work-on-select").value;
  const muscleSelectGroup = document.getElementById("muscle-select-group");
  const equipmentSelectGroup = document.getElementById("equipment-select-group");
  
  const equipmentSelect = document.getElementById("equipment-select");
  equipmentSelect.innerHTML = `<option value="">--Select--</option>`;
  
  const exerciseSelect = document.getElementById("exercise-select");
  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;
  
  let filteredByWorkoutType = [];
  if (selectedType === "home") {
    filteredByWorkoutType = exercisesData.filter(e => ["body weight", "resistance bands", "kettlebell"].includes(e.equipment));
  } else {
    filteredByWorkoutType = exercisesData;
  }
  
  if (selectedCategory === "specific muscle") {
    muscleSelectGroup.style.display = "block";
    equipmentSelectGroup.style.display = "block";
    const selectedMuscle = document.getElementById("muscle-select").value;
    if(selectedMuscle) {
      const filteredEquipment = [...new Set(filteredByWorkoutType.filter(e => e.category === selectedCategory && e.muscle === selectedMuscle).map(e => e.equipment))];
      equipmentSelect.innerHTML += filteredEquipment.map(eq => `<option value="${eq}">${eq.charAt(0).toUpperCase() + eq.slice(1)}</option>`).join('');
    }
  } else {
    muscleSelectGroup.style.display = "none";
    equipmentSelectGroup.style.display = "block";
    if (selectedCategory) {
      const filteredEquipment = [...new Set(filteredByWorkoutType.filter(e => e.category === selectedCategory).map(e => e.equipment))];
      equipmentSelect.innerHTML += filteredEquipment.map(eq => `<option value="${eq}">${eq.charAt(0).toUpperCase() + eq.slice(1)}</option>`).join('');
    }
  }
}

function filterExercises() {
  const selectedType = document.getElementById("workout-type-select").value;
  const selectedCategory = document.getElementById("work-on-select").value;
  const selectedEquipment = document.getElementById("equipment-select").value;
  const exerciseSelect = document.getElementById("exercise-select");
  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;
  
  let filteredByWorkoutType = [];
  if (selectedType === "home") {
    filteredByWorkoutType = exercisesData.filter(e => ["body weight", "resistance bands", "kettlebell"].includes(e.equipment));
  } else {
    filteredByWorkoutType = exercisesData;
  }

  let filteredExercises = [];
  if (selectedCategory === "specific muscle") {
    const selectedMuscle = document.getElementById("muscle-select").value;
    if (selectedMuscle && selectedEquipment) {
      filteredExercises = filteredByWorkoutType.filter(e => e.category === selectedCategory && e.muscle === selectedMuscle && e.equipment === selectedEquipment);
    }
  } else if (selectedCategory && selectedEquipment) {
    filteredExercises = filteredByWorkoutType.filter(e => e.category === selectedCategory && e.equipment === selectedEquipment);
  }
  
  if (filteredExercises.length > 0) {
    exerciseSelect.innerHTML += filteredExercises.map(ex => `<option value="${ex.name}">${ex.name}</option>`).join('');
  }
}

function renderSetWeightInputs() {
  const setsInput = document.getElementById("sets-input");
  const numSets = parseInt(setsInput.value);
  const container = document.getElementById("weight-inputs-container");
  container.innerHTML = "";
  
  if (numSets > 0) {
    for (let i = 1; i <= numSets; i++) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.placeholder = `Set ${i} (kg)`;
      input.className = "set-weight-input";
      container.appendChild(input);
    }
  }
}

function addExerciseToWorkout() {
  const exerciseName = document.getElementById("exercise-select").value;
  const sets = document.getElementById("sets-input").value;
  const reps = document.getElementById("reps-input").value;
  
  const setWeightInputs = Array.from(document.querySelectorAll('.set-weight-input'));
  const setWeights = setWeightInputs.map(input => parseFloat(input.value)).filter(w => !isNaN(w));

  if (!exerciseName || !sets || !reps || setWeights.length === 0) {
    alert("Please select an exercise and fill in all details.");
    return;
  }
  
  const maxWeight = Math.max(...setWeights);

  const newExercise = {
    id: editingRecord ? editingRecord.id : Date.now().toString(),
    name: exerciseName,
    sets: parseInt(sets),
    reps: parseInt(reps),
    setWeights: setWeights,
    maxWeight: maxWeight
  };

  if (editingRecord) {
    const index = currentWorkoutExercises.findIndex(ex => ex.id === editingRecord.id);
    if (index > -1) {
      currentWorkoutExercises[index] = newExercise;
    } else {
      currentWorkoutExercises.push(newExercise);
    }
  } else {
    currentWorkoutExercises.push(newExercise);
  }

  renderCurrentWorkoutList();
  resetLoggerForm();
}

function renderCurrentWorkoutList() {
  const listContainer = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";
  
  if (currentWorkoutExercises.length > 0) {
    listContainer.style.display = "block";
    currentWorkoutExercises.forEach((ex, index) => {
      const item = document.createElement("div");
      item.className = "workout-item";
      item.innerHTML = `${ex.name}: ${ex.sets} sets of ${ex.reps} reps. Heaviest: ${ex.maxWeight}kg
                        <button onclick="removeExerciseFromWorkout(${index})" style="float:right; padding:5px 10px; font-size:12px; margin-top:-5px; background: #a55;">Remove</button>`;
      list.appendChild(item);
    });
  } else {
    listContainer.style.display = "none";
  }
}

function removeExerciseFromWorkout(index) {
    currentWorkoutExercises.splice(index, 1);
    renderCurrentWorkoutList();
}

function resetLoggerForm() {
    editingRecord = null;
    document.getElementById("edit-mode-message").style.display = "none";
    document.getElementById("workout-type-select").value = "";
    document.getElementById("work-on-select").value = "";
    document.getElementById("muscle-select-group").style.display = "none";
    document.getElementById("muscle-select").value = "";
    document.getElementById("equipment-select").innerHTML = `<option value="">--Select--</option>`;
    document.getElementById("exercise-select").innerHTML = `<option value="">--Select--</option>`;
    document.getElementById("sets-input").value = "3";
    document.getElementById("reps-input").value = "10";
    renderSetWeightInputs();
    document.getElementById("add-exercise-btn").textContent = "Add Exercise to Session";
    document.getElementById("save-session-btn").textContent = "Save Entire Session";
}

function saveSession() {
  const workoutDateTime = document.getElementById('workout-datetime').value;
  if (currentWorkoutExercises.length === 0 || !workoutDateTime) {
    alert("Please add at least one exercise and specify a date/time.");
    return;
  }
  
  const isUpdating = document.getElementById("save-session-btn").textContent.includes("Update");

  if (isUpdating) {
    updateSavedRecord(currentWorkoutExercises[0], workoutDateTime);
  } else {
    currentWorkoutExercises.forEach(ex => {
        const record = {
            id: ex.id,
            date: workoutDateTime,
            sets: ex.sets,
            reps: ex.reps,
            setWeights: ex.setWeights,
            maxWeight: ex.maxWeight
        };
        if (!userWorkoutData[ex.name]) {
            userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
        }
        userWorkoutData[ex.name].records.push(record);
        if (record.maxWeight > userWorkoutData[ex.name].bestWeight) {
            userWorkoutData[ex.name].bestWeight = record.maxWeight;
        }
    });
  }
  
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert(isUpdating ? "Workout session updated successfully!" : "Workout session saved successfully!");
  
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();
  resetLoggerForm();
  document.getElementById('workout-datetime').value = new Date().toISOString().slice(0, 16);
}

function updateSavedRecord(updatedRecord, workoutDateTime) {
  if (!editingRecord) return;
  const exerciseName = editingRecord.name;
  const recordId = editingRecord.id;

  const history = userWorkoutData[exerciseName];
  const recordIndex = history.records.findIndex(r => r.id === recordId);
  
  if (recordIndex > -1) {
    history.records[recordIndex] = {
      ...updatedRecord,
      date: workoutDateTime,
      name: exerciseName,
      id: recordId 
    };

    const newMax = Math.max(...history.records.map(r => r.maxWeight));
    history.bestWeight = isFinite(newMax) ? newMax : 0;
  }
  editingRecord = null;
}

// --- History View Logic ---
function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData);
  
  historySelect.innerHTML = `<option value="">--Select an Exercise--</option>`;
  historySelect.innerHTML += recordedExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');
  
  document.getElementById("history-details").style.display = "none";
}

function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  const bestWeightTitle = document.getElementById("best-weight-title");
  const historyLog = document.getElementById("history-log");
  
  if (!selectedExercise) {
    historyDetails.style.display = "none";
    return;
  }
  
  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];
  
  bestWeightTitle.textContent = `Best Weight: ${history.bestWeight}kg`;
  
  historyLog.innerHTML = "";
  const sortedRecords = history.records.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Data for the Chart.js graph
  const dates = sortedRecords.map(record => new Date(record.date).toLocaleDateString());
  const maxWeights = sortedRecords.map(record => record.maxWeight);
  
  if (myChart) {
    myChart.destroy();
  }
  
  const ctx = document.getElementById('history-chart').getContext('2d');
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Heaviest Lift (kg)',
        data: maxWeights,
        borderColor: 'orange',
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Date', color: 'white' },
          ticks: { color: 'white' }
        },
        y: {
          title: { display: true, text: 'Weight (kg)', color: 'white' },
          ticks: { color: 'white' }
        }
      },
      plugins: {
        legend: { labels: { color: 'white' } }
      }
    }
  });
  
  sortedRecords.forEach(record => {
    const listItem = document.createElement("li");
    const dateString = new Date(record.date).toLocaleString();
    const weightsString = record.setWeights.join(', ');
    
    listItem.innerHTML = `
      <span>
        Date: ${dateString} | Sets: ${record.sets} | Reps: ${record.reps} | Weights: ${weightsString}kg
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(listItem);
  });
}

function deleteRecord(exerciseName, recordId) {
  if (confirm("Are you sure you want to delete this record?")) {
    const history = userWorkoutData[exerciseName];
    history.records = history.records.filter(record => record.id !== recordId);

    if (history.records.length === 0) {
      delete userWorkoutData[exerciseName];
    } else {
      const newMax = Math.max(...history.records.map(r => r.maxWeight));
      history.bestWeight = isFinite(newMax) ? newMax : 0;
    }
    
    localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
    populateHistoryDropdown();
    displayExerciseHistory();
  }
}

function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const recordToEdit = history.records.find(record => record.id === recordId);
  
  if (recordToEdit) {
    showLoggerView();
    
    editingRecord = recordToEdit;
    document.getElementById("edit-mode-message").style.display = "block";
    document.getElementById("add-exercise-btn").textContent = "Update Exercise";
    document.getElementById("save-session-btn").textContent = "Update Session";
    
    document.getElementById("workout-datetime").value = recordToEdit.date;
    document.getElementById("work-on-select").value = exercisesData.find(e => e.name === exerciseName).category;
    
    if (exercisesData.find(e => e.name === exerciseName).category === "specific muscle") {
      document.getElementById("muscle-select-group").style.display = "block";
      document.getElementById("muscle-select").value = exercisesData.find(e => e.name === exerciseName).muscle;
    }

    filterEquipment();
    document.getElementById("equipment-select").value = exercisesData.find(e => e.name === exerciseName).equipment;
    filterExercises();
    document.getElementById("exercise-select").value = exerciseName;
    
    document.getElementById("sets-input").value = recordToEdit.sets;
    document.getElementById("reps-input").value = recordToEdit.reps;
    
    renderSetWeightInputs();
    const setWeightInputs = document.querySelectorAll('.set-weight-input');
    recordToEdit.setWeights.forEach((weight, index) => {
      if (setWeightInputs[index]) {
        setWeightInputs[index].value = weight;
      }
    });
    
    currentWorkoutExercises = [recordToEdit];
    renderCurrentWorkoutList();
  }
}
