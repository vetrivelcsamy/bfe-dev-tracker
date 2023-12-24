// Problem object
class Problem {
  constructor(id, index, name, level, url, submissionTime, proficiency) {
    this.id = id;
    this.index = index;
    this.name = name;
    this.level = level;
    this.url = url;
    this.submissionTime = submissionTime;
    this.proficiency = proficiency;
  }
}

// Ebbinghaus forgetting curve
const forggetingCurve = [
  1 * 24 * 60, // 1 day
  2 * 24 * 60, // 2 day
  4 * 24 * 60, // 4 day
  7 * 24 * 60, // 7 day
  15 * 24 * 60, // 15 day
  30 * 24 * 60, // 30 day
];

// Function to check if a problem needs review
const needReview = (problem) => {
  if (problem.proficiency >= forggetingCurve.length) {
    return false;
  }

  const currentTime = Date.now();
  const timeDiffInMinute = (currentTime - problem.submissionTime) / (1000 * 60);
  return timeDiffInMinute >= forggetingCurve[problem.proficiency];
};

// Read User Configuration
let easy_proficiency_steps = [1, 3];
let medium_proficiency_steps = [1, 3, 4];
let hard_proficiency_steps = [0, 1, 2, 3, 4];

// Function to read configuration
const readConfig = () => {
  chrome.storage.local.get("config", (config) => {
    if (config !== undefined) {
      ({
        easy_proficiency_steps,
        medium_proficiency_steps,
        hard_proficiency_steps,
      } = config);
    }
  });
};

// Function to get difficulty based steps
const getDifficultyBasedSteps = (difficulty) => {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return easy_proficiency_steps;
    case "medium":
      return medium_proficiency_steps;
    default:
      return hard_proficiency_steps;
  }
};

// Function to extract basic problem information
const extractProblemInfo = async () => {
  const QUESTION_INFO = JSON.parse(
    document.getElementById("__NEXT_DATA__").innerText
  );
  const item = QUESTION_INFO.props.pageProps.item;
  const permalink = QUESTION_INFO.query.permalink;
  const PAGE_TYPE = QUESTION_INFO.page === "/problem/[permalink]" ? "problem" : "quiz"; // quiz or problem

  return {
    problemId: item.id,
    problemIndex: permalink,
    problemName: item.title,
    problemLevel: item.difficulty,
    problemUrl: `https://bigfrontend.dev/${PAGE_TYPE}/${permalink}`,
  };
};

// Function to monitor submission result
const monitorSubmissionResult = async () => {
  console.log("monitorSubmissionResult: submitted!");

  let maxRetry = 10;
  const retryInterval = 1000;

  const functionId = setInterval(async () => {
    if (maxRetry <= 0) {
      clearInterval(functionId);
      return;
    }

    const submissionResultSelector = 'p[class^="TestResultView__Success"]' || 'p[class^="permalink__Success"]';
    const submissionResult = document.querySelector(submissionResultSelector);

    if (!submissionResult) {
      maxRetry--;
      return;
    }

    clearInterval(functionId);
    const isSuccess = submissionResult.innerText.includes("👍 well done! all cases passed" || "👍 well done! it passed");

    const submissionTime = Date.now();
    const { problemId, problemIndex, problemName, problemLevel, problemUrl } =
      await extractProblemInfo();

    const steps = getDifficultyBasedSteps(problemLevel);

    try {
      const problems = await new Promise((resolve, reject) => {
        chrome.storage.local.get("bfe_records", (result) => {
          const problems = result.bfe_records;
          if (!problems || !problems[problemIndex]) {
            reject(problems);
          } else {
            resolve(problems);
          }
        });
      });

      if (needReview(problems[problemIndex]) && isSuccess) {
        let nextProficiencyIndex;
        for (const i of steps) {
          if (i > problems[problemIndex].proficiency) {
            nextProficiencyIndex = i;
            break;
          }
        }

        if (nextProficiencyIndex !== undefined) {
          problems[problemIndex].proficiency = nextProficiencyIndex;
        } else {
          problems[problemIndex].proficiency = steps[steps.length - 1]; // Assuming last step is maximum proficiency
        }

        problems[problemIndex].submissionTime = submissionTime;
        chrome.storage.local.set({ bfe_records: problems });
      }
    } catch (error) {
      if (isSuccess) {
        chrome.storage.local.get("bfe_records", (result) => {
          let problems = result.bfe_records || {};
          problems[problemIndex] = new Problem(
            problemId,
            problemIndex,
            problemName,
            problemLevel,
            problemUrl,
            submissionTime,
            steps[0]
          );
          chrome.storage.local.set({ bfe_records: problems });
        });
      }
    } finally {
      console.log("Submission successfully tracked!");
    }
  }, retryInterval);
};

const isSubmitButton = (element) => {
  return element.classList.contains("UI__ButtonRun-hjyhbh-1");
};

document.addEventListener("click", (event) => {
  const element = event.target;

  const filterConditions = [
    isSubmitButton(element),
    element.parentElement && isSubmitButton(element.parentElement),
    element.parentElement &&
      element.parentElement.parentElement &&
      isSubmitButton(element.parentElement.parentElement),
  ];

  const isSubmission = filterConditions.reduce((prev, curr) => prev || curr);

  if (isSubmission) {
    console.log("Submission submitted!");
    monitorSubmissionResult();
  }
});