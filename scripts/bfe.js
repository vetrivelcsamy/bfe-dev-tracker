// Problem object
class Problem {
  constructor(index, name, level, url, submissionTime, proficiency) {
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

/* Main Body */

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
const getDifficultyBasedSteps = (diffculty) => {
  if (diffculty === "Easy" || diffculty === "easy") {
    return easy_proficiency_steps;
  } else if (diffculty === "Medium" || diffculty === "medium") {
    return medium_proficiency_steps;
  } else {
    return hard_proficiency_steps;
  }
};

// Function to extract basic problem information
const extractProblemInfo = async () => {
  const QUESTION_INFO = document.getElementById("__NEXT_DATA__").innerText;

  return {
    problemIndex: JSON.parse(QUESTION_INFO)["props"]["pageProps"]["item"]["id"],
    problemName:
      JSON.parse(QUESTION_INFO)["props"]["pageProps"]["item"]["title"],
    problemLevel:
      JSON.parse(QUESTION_INFO)["props"]["pageProps"]["item"]["difficulty"],
    problemUrl: `https://bigfrontend.dev/problem/${
      JSON.parse(QUESTION_INFO)["query"]["permalink"]
    }`,
  };
};

// Function to monitor submission result
const monitorSubmissionResult = () => {
  console.log("monitorSubmissionResult: submitted!");

  let submissionResult;
  let maxRetry = 10;
  const retryInterval = 1000;

  const functionId = setInterval(async () => {
    if (maxRetry <= 0) {
      clearInterval(functionId);
      return;
    }

    submissionResult = document.querySelector(
      "#__next > div.Page__Outer-sc-90ozb8-0.cCuUVy > main > div.ProblemDetailJS__Judge-ffiw7z-3.dxhNjB > div.ProblemDetailJS__JudgeFooter-ffiw7z-5.enghjr > div.ProblemDetailJS__Logs-ffiw7z-6.ezuvBO > p.TestResultView__Success-sc-20rtgt-0.fzUVDA"
    );

    if (!submissionResult) {
      maxRetry--;
      return;
    }

    clearInterval(functionId);
    let isSuccess = submissionResult.innerText.includes(
      "👍 well done! all cases passed"
    );

    const submissionTime = Date.now();
    const { problemIndex, problemName, problemLevel, problemUrl } =
      await extractProblemInfo();

    console.log(problemIndex, "-------");

    const steps = getDifficultyBasedSteps(problemLevel);

    const promise = new Promise((resolve, reject) => {
      chrome.storage.local.get("bfe_records", (result) => {
        const problems = result.records;
        if (problems === undefined || problems[problemIndex] === undefined) {
          reject(problems);
        } else {
          resolve(problems);
        }
      });
    });

    promise
      .then(
        // problem submitted before
        (problems) => {
          const problem = problems[problemIndex];
          const reviewNeeded = needReview(problem);
          if (reviewNeeded && isSuccess) {
            let nextProficiencyIndex;
            for (const i of steps) {
              if (i > problem.proficiency) {
                nextProficiencyIndex = i;
                break;
              }
            }

            // further review needed
            if (nextProficiencyIndex !== undefined) {
              problem.proficiency = nextProficiencyIndex;
              // already completed all review
            } else {
              problem.proficiency = forggetingCurve.length;
            }

            problem.submissionTime = submissionTime;
            monitorSubmissionResult;
            problems[problemIndex] = problem;
            chrome.storage.local.set({
              bfe_records: problems,
            });
          }
        },
        // first time submission
        (problems) => {
          if (isSuccess) {
            if (problems === undefined) {
              problems = {};
            }

            const problem = new Problem(
              problemIndex,
              problemName,
              problemLevel,
              problemUrl,
              submissionTime,
              steps[0]
            );

            problems[problemIndex] = problem;

            chrome.storage.local.set({
              bfe_records: problems,
            });
          }
        }
      )
      .finally(() => console.log("Submission successfully tracked!"));
  }, retryInterval);
};

// Function to check if the clicked element is the submit button
const isSubmitButton = (element) => {
  return (
    element.getAttribute(SUBMIT_BUTTON_ATTRIBUTE_NAME) ===
    SUBMIT_BUTTON_ATTRIBUTE_VALUE
  );
};

// Event listener for click event
document.addEventListener("click", (event) => {
  const element = event.target;

  if (element.innerText.includes("submit")) {
    monitorSubmissionResult();
    console.log("Submisson submitted!");
  }
});