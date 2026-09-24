/**
 * @name Countdown Timer
 * @description Adds a countdown timer that pauses playback and exits the player after prolonged inactivity.
 * @version 1.0.0
 * @author JackVonDanger
 */

class CountdownTimerPlugin {
  constructor() {
    this.STORAGE_KEY = "stremio-countdown-timer-settings";

    this.settings = {
      enabled: false,
      minutes: 30,
    };

    this.lastActivityTime = Date.now();
    this.timerTriggered = false;
    this.overlayActive = false;
    this.autoExitTimeout = null;
    this.timerInterval = null;

    this.loadSettings();
    this.init();
  }

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------

  init() {
    this.addCountdownTimerButton();

    setTimeout(() => this.addCountdownTimerButton(), 500);
    setTimeout(() => this.addCountdownTimerButton(), 1500);
    setTimeout(() => this.addCountdownTimerButton(), 3000);

    const observer = new MutationObserver(() => {
      this.addCountdownTimerButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // User activity resets the countdown timer.
    window.addEventListener("mousemove", () => this.resetActivity());
    window.addEventListener("keydown", () => this.resetActivity());
    window.addEventListener("mousedown", () => this.resetActivity());
    window.addEventListener("wheel", () => this.resetActivity());
    window.addEventListener("touchstart", () => this.resetActivity());

    // Check the countdown periodically.
    this.timerInterval = setInterval(() => {
      this.checkTimer();
    }, 1000);
  }

  // ------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        this.settings.enabled =
          typeof parsed.enabled === "boolean"
            ? parsed.enabled
            : false;

        this.settings.minutes =
          typeof parsed.minutes === "number"
            ? parsed.minutes
            : 30;
      }
    } catch (error) {
      console.warn("[Countdown Timer] Failed to load settings:", error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.warn("[Countdown Timer] Failed to save settings:", error);
    }
  }

  // ------------------------------------------------------------
  // Player button
  // ------------------------------------------------------------

  addCountdownTimerButton() {
    const controlBarSelectors = [
      ".control-bar-buttons-menu-container-M6L0_",
      "[class*='control-bar-buttons']",
      "[class*='control-bar'] [class*='buttons']",
      ".control-bar-container-xsWA7 [class*='buttons']",
    ];

    let controlBarContainer = null;

    for (const selector of controlBarSelectors) {
      controlBarContainer = document.querySelector(selector);

      if (controlBarContainer) {
        break;
      }
    }

    if (!controlBarContainer) {
      return;
    }

    // Don't create duplicates.
    if (
      controlBarContainer.querySelector(
        ".countdown-timer-plugin-button"
      )
    ) {
      return;
    }

    const countdownButton = document.createElement("div");

    countdownButton.tabIndex = -1;

    countdownButton.className =
      "control-bar-button-FQUsj button-container-zVLH6 countdown-timer-plugin-button";

    countdownButton.title = "Countdown Timer";

    countdownButton.innerHTML = `
      <svg
        class="icon-qy6I6 custom-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
      >
        <!-- Clock body -->
        <circle
          cx="12"
          cy="13"
          r="7"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <!-- Hands -->
        <path
          d="M12 9V13L14.5 15"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Left alarm bell -->
        <path
          d="M5.5 7L3.5 5.5L5.5 3.5L8 5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Right alarm bell -->
        <path
          d="M18.5 7L20.5 5.5L18.5 3.5L16 5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Feet -->
        <path
          d="M7 19L5.5 21"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />

        <path
          d="M17 19L18.5 21"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
    `;

    countdownButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showSettingsPopup();
    });

    countdownButton.addEventListener("mouseenter", () => {
      countdownButton.style.opacity = "0.8";
    });

    countdownButton.addEventListener("mouseleave", () => {
      countdownButton.style.opacity = "1";
    });

    controlBarContainer.insertAdjacentElement(
      "afterbegin",
      countdownButton
    );
  }

  // ------------------------------------------------------------
  // Video detection
  // ------------------------------------------------------------

  getActiveVideo() {
    const videos = Array.from(
      document.querySelectorAll("video")
    );

    if (!videos.length) {
      return null;
    }

    const score = (video) => {
      const rect = video.getBoundingClientRect();

      const area =
        Math.max(0, rect.width) *
        Math.max(0, rect.height);

      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0;

      const playing =
        !video.paused &&
        !video.ended &&
        video.readyState >= 2;

      return (
        (playing ? 1e12 : 0) +
        (visible ? 1e9 : 0) +
        area
      );
    };

    return videos.sort(
      (a, b) => score(b) - score(a)
    )[0];
  }

  // ------------------------------------------------------------
  // Activity tracking
  // ------------------------------------------------------------

  resetActivity() {
    this.lastActivityTime = Date.now();
  }

  // ------------------------------------------------------------
  // Timer
  // ------------------------------------------------------------

  checkTimer() {
    if (!this.settings.enabled) {
      return;
    }

    if (this.overlayActive) {
      return;
    }

    const video = this.getActiveVideo();

    if (!video) {
      return;
    }

    // Only count time while playback is actually running.
    if (video.paused || video.ended) {
      return;
    }

    const inactivityLimit =
      this.settings.minutes * 60 * 1000;

    const inactiveFor =
      Date.now() - this.lastActivityTime;

    if (inactiveFor >= inactivityLimit) {
      this.triggerCountdownTimer(video);
    }
  }

  // ------------------------------------------------------------
  // Countdown timer trigger
  // ------------------------------------------------------------

  triggerCountdownTimer(video) {
    if (this.overlayActive) {
      return;
    }

    this.overlayActive = true;
    this.timerTriggered = true;

    video.pause();

    this.showCountdownOverlay(video);
  }

  // ------------------------------------------------------------
  // Settings popup
  // ------------------------------------------------------------

  showSettingsPopup() {
    const existing = document.getElementById(
      "stremio-countdown-timer-settings"
    );

    if (existing) {
      existing.remove();
      return;
    }

    const overlay = document.createElement("div");

    overlay.id =
      "stremio-countdown-timer-settings";

    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999998;

      display: flex;
      align-items: center;
      justify-content: center;

      background: rgba(0, 0, 0, 0.45);

      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);

      font-family:
        'Inter',
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        Roboto,
        sans-serif;

      color: white;
    `;

    const dialog = document.createElement("div");

    dialog.style.cssText = `
      width: 360px;
      max-width: calc(100vw - 40px);

      background: rgba(25, 25, 30, 0.92);

      border:
        1px solid
        rgba(255, 255, 255, 0.10);

      border-radius: 20px;

      padding: 28px;

      box-shadow:
        0 25px 60px
        rgba(0, 0, 0, 0.65);

      box-sizing: border-box;
    `;

    // ----------------------------------------------------------
    // Header
    // ----------------------------------------------------------

    const header = document.createElement("div");

    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;

      margin-bottom: 24px;
    `;

    const title = document.createElement("div");

    title.innerText = "Countdown Timer";

    title.style.cssText = `
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.4px;
    `;

    const closeButton = document.createElement("div");

    closeButton.innerHTML = "×";

    closeButton.style.cssText = `
      width: 32px;
      height: 32px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 50%;

      color: rgba(255,255,255,0.65);

      font-size: 25px;
      font-weight: 300;

      cursor: pointer;

      transition: background 0.15s ease;
    `;

    closeButton.addEventListener(
      "mouseenter",
      () => {
        closeButton.style.background =
          "rgba(255,255,255,0.10)";
      }
    );

    closeButton.addEventListener(
      "mouseleave",
      () => {
        closeButton.style.background =
          "transparent";
      }
    );

    closeButton.addEventListener(
      "click",
      () => overlay.remove()
    );

    header.appendChild(title);
    header.appendChild(closeButton);

    // ----------------------------------------------------------
    // Enable / Disable
    // ----------------------------------------------------------

    const enableRow = document.createElement("div");

    enableRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;

      padding: 16px 0;

      border-top:
        1px solid
        rgba(255,255,255,0.08);

      border-bottom:
        1px solid
        rgba(255,255,255,0.08);
    `;

    const enableTextContainer =
      document.createElement("div");

    const enableTitle =
      document.createElement("div");

    enableTitle.innerText = "Countdown Timer";

    enableTitle.style.cssText = `
      font-size: 16px;
      font-weight: 500;
    `;

    const enableDescription =
      document.createElement("div");

    enableDescription.innerText =
      "Pause playback after inactivity";

    enableDescription.style.cssText = `
      margin-top: 3px;

      font-size: 13px;

      color:
        rgba(255,255,255,0.45);
    `;

    enableTextContainer.appendChild(enableTitle);
    enableTextContainer.appendChild(enableDescription);

    // ----------------------------------------------------------
    // Toggle
    // ----------------------------------------------------------

    const toggle = document.createElement("div");

    toggle.style.cssText = `
      width: 48px;
      height: 28px;

      flex-shrink: 0;

      border-radius: 999px;

      cursor: pointer;

      position: relative;

      transition:
        background 0.2s ease;
    `;

    const toggleKnob =
      document.createElement("div");

    toggleKnob.style.cssText = `
      position: absolute;

      width: 22px;
      height: 22px;

      top: 3px;

      border-radius: 50%;

      background: white;

      box-shadow:
        0 2px 6px
        rgba(0,0,0,0.35);

      transition:
        left 0.2s ease;
    `;

    toggle.appendChild(toggleKnob);

    const updateToggle = () => {
      if (this.settings.enabled) {
        toggle.style.background =
          "linear-gradient(135deg, #6366f1, #a855f7)";

        toggleKnob.style.left = "23px";
      } else {
        toggle.style.background =
          "rgba(255,255,255,0.18)";

        toggleKnob.style.left = "3px";
      }
    };

    updateToggle();

    toggle.addEventListener(
      "click",
      () => {
        this.settings.enabled =
          !this.settings.enabled;

        this.resetActivity();
        this.saveSettings();

        updateToggle();
      }
    );

    enableRow.appendChild(
      enableTextContainer
    );

    enableRow.appendChild(toggle);

    // ----------------------------------------------------------
    // Timer selection
    // ----------------------------------------------------------

    const timerSection =
      document.createElement("div");

    timerSection.style.cssText = `
      margin-top: 24px;
    `;

    const timerLabel =
      document.createElement("div");

    timerLabel.innerText =
      "Inactivity timeout";

    timerLabel.style.cssText = `
      font-size: 14px;
      font-weight: 500;

      margin-bottom: 10px;

      color:
        rgba(255,255,255,0.75);
    `;

    const select =
      document.createElement("select");

    select.style.cssText = `
      width: 100%;

      box-sizing: border-box;

      padding: 13px 14px;

      border:
        1px solid
        rgba(255,255,255,0.12);

      border-radius: 12px;

      background:
        rgba(255,255,255,0.07);

      color: white;

      font-size: 15px;

      outline: none;

      cursor: pointer;
    `;

    const timeOptions = [
      5,
      10,
      15,
      20,
      30,
      45,
      60,
      90,
      120,
    ];

    for (const minutes of timeOptions) {
      const option =
        document.createElement("option");

      option.value = minutes;

      option.innerText =
        minutes === 1
          ? "1 minute"
          : `${minutes} minutes`;

      option.style.background =
        "#202025";

      select.appendChild(option);
    }

    select.value =
      String(this.settings.minutes);

    select.addEventListener(
      "change",
      () => {
        this.settings.minutes =
          Number(select.value);

        this.resetActivity();
        this.saveSettings();
      }
    );

    timerSection.appendChild(timerLabel);
    timerSection.appendChild(select);

    // ----------------------------------------------------------
    // Current status
    // ----------------------------------------------------------

    const status =
      document.createElement("div");

    status.style.cssText = `
      margin-top: 18px;

      padding: 12px 14px;

      border-radius: 10px;

      background:
        rgba(255,255,255,0.045);

      color:
        rgba(255,255,255,0.50);

      font-size: 12px;

      line-height: 1.45;
    `;

    status.innerText =
      "The timer resets whenever you interact with the player.";

    // ----------------------------------------------------------
    // Close button
    // ----------------------------------------------------------

    const doneButton =
      document.createElement("div");

    doneButton.innerText = "Done";

    doneButton.style.cssText = `
      margin-top: 22px;

      width: 100%;

      box-sizing: border-box;

      padding: 12px;

      text-align: center;

      border-radius: 12px;

      background:
        linear-gradient(
          135deg,
          #6366f1,
          #a855f7
        );

      color: white;

      font-size: 15px;

      font-weight: 600;

      cursor: pointer;

      transition:
        transform 0.15s ease,
        opacity 0.15s ease;
    `;

    doneButton.addEventListener(
      "mouseenter",
      () => {
        doneButton.style.opacity = "0.9";
      }
    );

    doneButton.addEventListener(
      "mouseleave",
      () => {
        doneButton.style.opacity = "1";
      }
    );

    doneButton.addEventListener(
      "click",
      () => {
        overlay.remove();
      }
    );

    // ----------------------------------------------------------
    // Assemble
    // ----------------------------------------------------------

    dialog.appendChild(header);
    dialog.appendChild(enableRow);
    dialog.appendChild(timerSection);
    dialog.appendChild(status);
    dialog.appendChild(doneButton);

    overlay.appendChild(dialog);

    document.body.appendChild(overlay);

    // Clicking outside closes the popup.
    overlay.addEventListener(
      "click",
      (event) => {
        if (event.target === overlay) {
          overlay.remove();
        }
      }
    );
  }

  // ------------------------------------------------------------
  // "Are you still watching?" overlay
  // ------------------------------------------------------------

  showCountdownOverlay(video) {
    const existing =
      document.getElementById(
        "stremio-countdown-timer-overlay"
      );

    if (existing) {
      existing.remove();
    }

    const overlay =
      document.createElement("div");

    overlay.id =
      "stremio-countdown-timer-overlay";

    overlay.style.cssText = `
      position: fixed;

      top: 0;
      left: 0;

      width: 100vw;
      height: 100vh;

      z-index: 999999;

      display: flex;

      align-items: center;
      justify-content: center;

      background:
        rgba(0, 0, 0, 0.45);

      backdrop-filter:
        blur(16px);

      -webkit-backdrop-filter:
        blur(16px);

      opacity: 0;

      transition:
        opacity 0.4s ease;

      font-family:
        'Inter',
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        Roboto,
        sans-serif;

      color: white;
    `;

    const dialog =
      document.createElement("div");

    dialog.style.cssText = `
      background:
        rgba(20, 20, 25, 0.88);

      border:
        1px solid
        rgba(255,255,255,0.08);

      border-radius: 20px;

      padding: 48px 64px;

      text-align: center;

      box-shadow:
        0 25px 50px -12px
        rgba(0,0,0,0.7);

      transform:
        scale(0.95)
        translateY(10px);

      transition:
        transform 0.5s
        cubic-bezier(
          0.175,
          0.885,
          0.32,
          1.275
        );

      max-width:
        calc(100vw - 40px);

      box-sizing: border-box;
    `;

    // ----------------------------------------------------------
    // Heading
    // ----------------------------------------------------------

    const h2 =
      document.createElement("h2");

    h2.innerText =
      "Are you still watching?";

    h2.style.cssText = `
      margin: 0 0 8px 0;

      font-size: 28px;

      font-weight: 600;

      letter-spacing: -0.5px;
    `;

    // ----------------------------------------------------------
    // Description
    // ----------------------------------------------------------

    const p =
      document.createElement("p");

    p.innerText =
      "Playback has been paused due to inactivity.";

    p.style.cssText = `
      margin: 0 0 32px 0;

      font-size: 16px;

      color:
        rgba(255,255,255,0.5);
    `;

    // ----------------------------------------------------------
    // Resume button
    // ----------------------------------------------------------

    const button =
      document.createElement("div");

    button.innerText =
      "Yes, I'm here";

    button.style.cssText = `
      display: inline-block;

      background:
        linear-gradient(
          135deg,
          #6366f1,
          #a855f7
        );

      color: white;

      border: none;

      padding:
        14px 40px;

      font-size: 16px;

      font-weight: 600;

      border-radius: 99px;

      cursor: pointer;

      transition:
        all 0.2s ease;

      box-shadow:
        0 8px 20px -6px
        rgba(168,85,247,0.6);
    `;

    button.addEventListener(
      "mouseenter",
      () => {
        button.style.transform =
          "translateY(-2px) scale(1.02)";

        button.style.boxShadow =
          "0 12px 24px -6px rgba(168,85,247,0.8)";
      }
    );

    button.addEventListener(
      "mouseleave",
      () => {
        button.style.transform =
          "translateY(0) scale(1)";

        button.style.boxShadow =
          "0 8px 20px -6px rgba(168,85,247,0.6)";
      }
    );

    button.addEventListener(
      "mousedown",
      () => {
        button.style.transform =
          "scale(0.98)";
      }
    );

    dialog.appendChild(h2);
    dialog.appendChild(p);
    dialog.appendChild(button);

    overlay.appendChild(dialog);

    document.body.appendChild(overlay);

    // Animate in.
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";

      dialog.style.transform =
        "scale(1) translateY(0)";
    });

    // ----------------------------------------------------------
    // Resume
    // ----------------------------------------------------------

    const closeOverlayAndResume = () => {
      clearTimeout(
        this.autoExitTimeout
      );

      this.autoExitTimeout = null;

      this.overlayActive = false;
      this.timerTriggered = false;

      this.resetActivity();

      overlay.style.opacity = "0";

      dialog.style.transform =
        "scale(0.95) translateY(10px)";

      setTimeout(() => {
        overlay.remove();

        const currentVideo =
          this.getActiveVideo() || video;

        if (currentVideo) {
          currentVideo.play().catch(() => {});
        }
      }, 400);
    };

    button.addEventListener(
      "click",
      closeOverlayAndResume
    );

    // ----------------------------------------------------------
    // Auto exit
    // ----------------------------------------------------------

    this.autoExitTimeout = setTimeout(() => {
      this.overlayActive = false;

      overlay.style.opacity = "0";

      setTimeout(() => {
        overlay.remove();

        window.history.back();
      }, 400);
    }, 2 * 60 * 1000);
  }
}

// --------------------------------------------------------------
// Start plugin
// --------------------------------------------------------------

new CountdownTimerPlugin();
