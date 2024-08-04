// ==UserScript==
// @name          Pixiv Repeated Artworks Hider
// @namespace     =
// @match         *://www.pixiv.net/*
// @icon          https://www.google.com/s2/favicons?domain=pixiv.net
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_deleteValue
// @grant         GM_listValues
// @inject-into   content
// @run-at        document-idle
// @version       2.3
// @author        SADNESS81
// @description   Hides an artwork after it appears 3 times
// @license       MIT
// ==/UserScript==

const noReprocess = new Set();
const ppixiv = window.location.href.includes("#ppixiv");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const createElement = (tag, props) => Object.assign(document.createElement(tag), props);

const settings = {
  maxRepetitions: 3,
  hideAuthor: false,
  dimRepeated: false,
  whitelistFollowed: true,
  workOnRanking: false,
  workOnSearch: false,
};

for (const [key, defaultValue] of Object.entries(settings)) {
  settings[key] = GM_getValue(key, defaultValue);
  GM_setValue(key, settings[key]);
}

createUI(settings);
createObserver();
handleFollowing();

function handleRepetition(element, task) {
  const { idValue, gtmValue } = getValues(element);
  const value = settings.hideAuthor ? idValue : gtmValue;
  const repetitionCount = getCount(value);
  if (repetitionCount == 0) {
    noReprocess.add(value);
    GM_setValue(`${value}`, repetitionCount + 1);
  } else if (repetitionCount >= 1 && repetitionCount < settings.maxRepetitions && !noReprocess.has(value)) {
    noReprocess.add(value);
    GM_setValue(`${value}`, repetitionCount + 1);
  }

  if (task === "Reprocess") {
    let following = GM_getValue("following", []);
    let authorsToHide = GM_getValue("authorsToHide", []);
    if (
      (!noReprocess.has(value) && repetitionCount >= settings.maxRepetitions && !following.includes(idValue)) ||
      authorsToHide.includes(idValue)
    ) {
      const mainElement = element.closest(getTargets());
      if (!settings.dimRepeated) {
        if (ppixiv) {
          if (Array.from(mainElement.parentNode.children).every((sibling) => sibling.style.display === "none")) {
            mainElement.parentNode.style.display = "none";
          } else {
            mainElement.style.display = "none";
          }
        } else {
          mainElement.style.display = "none";
        }
      } else {
        mainElement.style.opacity = "0.2";
      }
    }
  }
}

async function handleFollowing(element, task, action) {
  if (!settings.whitelistFollowed) {
    GM_deleteValue("Account");
    GM_deleteValue("Following");
    return;
  }

  let userId = parseInt(
    Object.keys(localStorage)
      .find((key) => key.match(/^viewed_illust_ids_(\d+)$/))
      ?.match(/\d+/)
  );

  if (!userId) return;

  let user = GM_getValue("Account");
  let value = GM_getValue("Following", []);
  let times = GM_getValue("Times", 0);

  times = times < 30 ? times + 1 : 0;
  GM_setValue("Times", times);

  if (times === 0) {
    GM_setValue("Following", []);
    handleFollowing(null, "two", null);
  }

  if (user !== userId) {
    GM_setValue("Account", userId);
    GM_setValue("Following", []);
    value = [];
    user = userId;
  }

  if (task === "one" && value.length !== 0) {
    const { idValue } = getValues(element);
    if (
      idValue &&
      ((action === "add" && !value.includes(idValue)) || (action === "remove" && value.includes(idValue)))
    ) {
      value = action === "add" ? [...value, idValue] : value.filter((v) => v !== idValue);
      GM_setValue("Following", value);
    }
    GM_deleteValue(idValue.toString());
  }

  if (task === "two") {
    const fetchFollowing = async (restType) => {
      let offset = 0,
        total = 0;
      try {
        while (offset === 0 || offset < total) {
          await delay(1000);
          const data = await fetch(
            `https://www.pixiv.net/ajax/user/${userId}/following?offset=${offset}&limit=100&rest=${restType}`
          ).then((res) => res.json());
          if (data.body?.users) {
            value = [...new Set([...value, ...data.body.users.map((user) => user.userId)])];
            total = offset === 0 ? data.body.total : total;
            offset += 100;
          }
        }
      } catch (error) {
        console.error(`Error fetching following list for rest=${restType}:`, error);
      }
    };

    for (const restType of ["show", "hide"]) {
      await fetchFollowing(restType);
    }

    GM_setValue("Following", value);
    value.forEach((id) => GM_deleteValue(id.toString()));
  }
}

function getTargets() {
  const targets = ppixiv
    ? [`.thumbnails > div > div`]
    : [
        `.gtm-toppage-thumbnail-illustration-recommend-works-zone li.hcLnhb`, // Main page
        `.gtm-toppage-thumbnail-illustration-recommend-tag-zone li.PzuJB`,
        `.gtm-toppage-thumbnail-r18-illustration-recommend-works-zone li.hcLnhb`,
        `.gtm-toppage-thumbnail-r18-illustration-recommend-tag-zone li.PzuJB`,
        `.bGUtlw .gtm-illust-recommend-zone li`, // Discovery
        `.bGUtlw .gtm-illust-recommend-zone .dSVJt ul.hkzusx div.hLhHDu > div`,
        `.gtm-illust-recommend-zone .jtUPOE li`, // Related
        `#illust-recommend ul > li.image-item`, // Bookmarks
        settings.workOnSearch ? `ul.hdRpMN > li` : null, // Search Page
        settings.workOnRanking ? `.ranking-items.adjust > section` : null, // Ranking Page
      ]
        .filter(Boolean)
        .join(", ");
  return targets;
}

function getDetails(element) {
  const details = ppixiv
    ? [`.thumbnails a`]
    : [
        `#illust-recommend > ul > li > a.user.ui-profile-popup.js-click-trackable.gtm-illust-recommend-user-name`,
        `.sc-iasfms-3.frFjhu a`,
        `.ranking-image-item > a > div > img`,
      ];

  return element.querySelector(details);
}

function getValues(element) {
  const getValue = (...keys) => keys.reduce((acc, key) => acc || element.dataset[key], null);
  const idValue = ppixiv ? getValue("userId") : getValue("gtmUserId", "user_id", "userId");
  const gtmValue = ppixiv
    ? getValue("mediaId").replace("illust:", "").split("-")[0]
    : getValue("gtmRecommendIllustId", "gtmValue", "id");
  return { idValue, gtmValue };
}

function getCount(value) {
  return GM_getValue(`${value}`, 0);
}

function createUI(settings) {
  const [button, menu, maxRepetitionsInput] = [
    createElement("button", {
      textContent: "Settings",
      style:
        "position: fixed; z-index: 1000;  top: 85%; left: 96%; transform: translate(-50%, -50%); background-color: #181a1b; color: #ffffff;",
    }),
    createElement("div", {
      style:
        "position: fixed; z-index: 1000; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #181a1b; color: #ffffff; padding: 10px; border: 1px solid #3a3e41; border-radius: 5px; box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.1); display: none;",
    }),
    createElement("input", {
      type: "number",
      value: settings.maxRepetitions,
      min: 1,
    }),
  ];

  menu.append(createElement("label", { textContent: "Max Repetitions: " }), maxRepetitionsInput);

  maxRepetitionsInput.addEventListener("input", () => {
    let value = Math.max(parseInt(maxRepetitionsInput.value) || 1, 1);
    maxRepetitionsInput.value = value;
    GM_setValue("maxRepetitions", value);
  });

  const toggleCheckbox = (text, key, tooltip) => {
    const [p, checkbox] = [
      createElement("p", { textContent: `${text}: ${settings[key]}` }),
      createElement("input", { type: "checkbox", checked: settings[key], title: tooltip }),
    ];
    checkbox.addEventListener("change", () => {
      settings[key] = checkbox.checked;
      p.textContent = `${text}: ${settings[key]}`;
      GM_setValue(key, settings[key]);
    });
    menu.append(p, checkbox);
  };

  const checkBoxComments = [
    "Instead of hiding artworks the script will prioritize hiding every artwork from the same author",
    "Dims repeated content instead of hiding it",
    "Whitelists the artists that you follow",
    "Makes the script work on the ranking page",
    "Makes the script work on the search page",
  ];

  ["Hide Author", "Dim Repeated", "Whitelist Following", "Work On The Ranking Page", "Work On The Search Page"].forEach(
    (text, index) => {
      toggleCheckbox(text, Object.keys(settings)[index + 1], checkBoxComments[index]);
    }
  );

  setTimeout(() => {
    document.body.append(button, menu);
    button.addEventListener("click", () => {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", (event) => {
      if (!button.contains(event.target) && !menu.contains(event.target)) {
        menu.style.display = "none";
      }
    });
  }, 3000);
}

function createHideButton(element) {
  if (element.style.display !== "none") {
    const { idValue } = getValues(getDetails(element));
    const uniqueButtonId = `hide-button-${idValue}`;

    let title =
      element.querySelector("div > .jthKhf") || element.querySelector("h2") || element.querySelector("a")?.parentNode;

    const button = createElement("button", {
      textContent: "Hide Author",
      id: uniqueButtonId,
      style: `visibility: hidden; margin-left: 10px; background-color: #181a1b; color: #ffffff; border: none; padding: 5px 10px; cursor: pointer; `,
    });
    title.append(button);

    ["mouseover", "mouseout"].forEach((event) =>
      element.addEventListener(event, () => {
        button.style.visibility = event === "mouseover" ? "visible" : "hidden";
      })
    );

    button.addEventListener("click", () => {
      let authorsToHide = GM_getValue("authorsToHide", []);
      if (!authorsToHide.includes(idValue)) {
        authorsToHide.push(idValue);
        GM_setValue("authorsToHide", authorsToHide);
      }
      document
        .querySelectorAll(`#hide-button-${idValue}`)
        .forEach((identifier) => handleRepetition(getDetails(identifier.closest(getTargets())), "Reprocess"));
    });
  }
}

function createObserver() {
  const targets = getTargets();
  const cachedElements = new Set();
  const Intersection = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          handleRepetition(getDetails(entry.target));
        }
      });
    },
    { root: null, rootMargin: "0px", threshold: 1.0 }
  );

  const observeElements = () => {
    document.querySelectorAll(targets).forEach((element) => {
      if (!cachedElements.has(element)) {
        Intersection.observe(element);
        cachedElements.add(element);
        handleRepetition(getDetails(element), "Reprocess");
        createHideButton(element);
      }
    });

    document.querySelectorAll(".fliWFr").forEach((button) => {
      let value = GM_getValue("Following", []);
      if (!cachedElements.has(button)) {
        button.addEventListener("click", function () {
          if (value.length !== 0) {
            const action = button.textContent.trim().toLowerCase() === "following" ? "remove" : "add";
            handleFollowing(button, "one", action);
          } else {
            handleFollowing(null, "two");
          }
        });
        cachedElements.add(button);
      }
    });
  };

  let timeoutId;
  new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(observeElements, 100);
  }).observe(document.body, { childList: true, subtree: true });
}
