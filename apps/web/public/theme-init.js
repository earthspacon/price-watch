try {
  if (localStorage.theme === "light") {
    document.documentElement.dataset.theme = "light";
    document.querySelector('meta[name="theme-color"]').content = "#ffffff";
  }
} catch (error) {}
