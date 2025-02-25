import { effect, signal } from "@preact/signals-core";
import ScreencastPanel from "./ScreencastPanel.js";
import ScrollingStoppedMixin from "./ScrollingStoppedMixin.js";
import SoundMixin from "./SoundMixin.js";

const forceLoad = [ScreencastPanel];

const soundStorageKey = "sound";
const selectedIndexKey = "selectedIndex";

export default class ScreencastComic extends SoundMixin(
  ScrollingStoppedMixin(HTMLElement)
) {
  constructor() {
    super();
    const previousSelectedIndex =
      parseInt(localStorage.getItem(selectedIndexKey)) ?? -1;
    this.selectedIndexSignal = signal(previousSelectedIndex);
    this.sound = localStorage.getItem(soundStorageKey) ?? true;
    this.audioElement = null;
  }

  connectedCallback() {
    super.connectedCallback?.();

    // Make the comic a listbox
    this.setAttribute("role", "listbox");

    // Make the comic focusable
    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }

    // Clicking an item selects it. We use mouseup/touchend instead of "click"
    // because, on iOS, "click" doesn't seem to always fire.
    const clickHandler = (event) => {
      if (this.scrollInProgress) {
        return; // Ignore clicks while scrolling
      }
      const panel = event.target.closest("screencast-panel");
      if (panel) {
        this.selectedIndex = this.panels.indexOf(panel);
      }
    };
    this.addEventListener("mouseup", clickHandler);
    this.addEventListener("touchend", clickHandler);

    // Tell panels whether they're selected
    let firstSelection = false;
    effect(() => {
      if (this.selectedPanel && this.selectedPanel !== this.getCenterPanel()) {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion)"
        ).matches;
        const behavior =
          firstSelection || prefersReducedMotion ? "instant" : "smooth";
        this.selectedPanel?.scrollIntoView({
          behavior,
          block: "center",
        });
        firstSelection = false;
      }

      const selectedIndex = this.selectedIndex;
      this.panels.forEach((panel, index) => {
        panel.selected = index === selectedIndex;
        if (index < selectedIndex) {
          // Show past panels as finished
          panel.finish();
        } else if (index === selectedIndex) {
          // Show selected panel as playing
          panel.play();
        } else if (index > selectedIndex) {
          // Show future panels as not started
          panel.restart();
        }
      });
    });

    // Listen for changes in whether the panels do/don't want sound
    this.addEventListener("sound-change", (event) => {
      console.log("sound-change", event.detail);
      this.sound = event.detail.sound;
    });

    // Tell items whether to play sound
    effect(() => {
      this.panels.forEach((panel) => {
        panel.setAttribute("sound", this.sound);
      });
    });

    // Home/End/Up/Down keys move selection, Space toggles play
    this.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          if (event.altKey || event.metaKey) {
            this.selectFirst();
          } else {
            this.selectPrevious();
          }
          break;

        case "ArrowDown":
          event.preventDefault();
          if (event.altKey || event.metaKey) {
            this.selectLast();
          } else {
            this.selectNext();
          }
          break;

        case "End":
          event.preventDefault();
          this.selectLast();
          break;

        case "Home":
          event.preventDefault();
          this.selectFirst();
          break;

        // Space toggles play state of selected item
        case " ":
          event.preventDefault();
          if (this.selectedPanel) {
            this.selectedPanel.playing = !this.selectedPanel.playing;
          }
          break;
      }
    });

    // If we have items, select first panel by default
    if (this.selectedIndex === -1 && this.panels.length > 0) {
      // Select first item by default
      this.selectFirst();
    }

    // Save values in localStorage
    effect(() => {
      localStorage.setItem(selectedIndexKey, this.selectedIndex);
      localStorage.setItem(soundStorageKey, this.sound);
    });
  }

  // Return the item in the center of the viewport
  getCenterPanel() {
    const middle = window.innerHeight / 2;
    const panel = this.panels.find((item) => {
      const itemRect = item.getBoundingClientRect();
      return itemRect.top <= middle && middle <= itemRect.bottom;
    });
    return panel;
  }

  get panels() {
    return Array.from(this.children);
  }

  // Called by ScrollingStoppedMixin when scrolling appears to have stopped
  scrollingStopped() {
    this.selectCenterPanel();
  }

  selectCenterPanel() {
    const centerItem = this.getCenterPanel();
    if (centerItem !== this.selectedPanel) {
      this.selectedIndex = this.panels.indexOf(centerItem);
    }
  }

  get selectedPanel() {
    return this.panels[this.selectedIndex] ?? null;
  }

  get selectedIndex() {
    return this.selectedIndexSignal.value;
  }
  set selectedIndex(selected) {
    this.selectedIndexSignal.value = selected;
  }

  selectFirst() {
    this.selectedIndex = 0;
  }

  selectLast() {
    this.selectedIndex = this.panels.length - 1;
  }

  selectNext() {
    this.selectedIndex = Math.min(
      this.panels.length - 1,
      this.selectedIndex + 1
    );
  }

  selectPrevious() {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
  }
}

customElements.define("screencast-comic", ScreencastComic);
