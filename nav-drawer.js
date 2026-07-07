import { logout } from "./auth-guard.js";

export function initNavDrawer() {
  const drawer = document.getElementById("nav-drawer");
  const backdrop = document.getElementById("nav-drawer-backdrop");
  const openButton = document.getElementById("hamburger-button");

  if (!drawer || !backdrop || !openButton) return;

  function openDrawer() {
    drawer.classList.add("is-open");
    backdrop.classList.add("is-visible");
    drawer.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    drawer.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
  }

  openButton.addEventListener("click", () => {
    if (drawer.classList.contains("is-open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  backdrop.addEventListener("click", closeDrawer);

  drawer.querySelectorAll('a[data-disabled="true"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeDrawer();
    });
  });

  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  }
}
