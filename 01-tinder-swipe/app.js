const DECISION_THRESHOLD = 75;
let isAnimating = false;
let pullDeltaX = 0; // distance from the card being dragged
let isDragging = false; // Track whether the user is dragging

function startDrag(event) {
  if (isAnimating) return;

  const actualCard = event.target.closest("article");
  if (!actualCard) return;

  const startX = event.pageX ?? event.touches[0].pageX;

  // Set dragging flag to false initially
  isDragging = false;

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);

  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onEnd, { passive: true });

  function onMove(event) {
    const currentX = event.pageX ?? event.touches[0].pageX;
    pullDeltaX = currentX - startX;

    if (pullDeltaX !== 0) {
      isAnimating = true;
      isDragging = true; // Mark dragging as true when there is movement

      const deg = pullDeltaX / 14;
      actualCard.style.transform = `translateX(${pullDeltaX}px) rotate(${deg}deg)`;
      actualCard.style.cursor = "grabbing";

      const opacity = Math.abs(pullDeltaX) / 100;
      const isRight = pullDeltaX > 0;
      const choiceEl = isRight
        ? actualCard.querySelector(".choice.like")
        : actualCard.querySelector(".choice.nope");

      choiceEl.style.opacity = opacity;
    }
  }

  function onEnd(event) {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);

    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);

    const decisionMade = Math.abs(pullDeltaX) >= DECISION_THRESHOLD;

    if (decisionMade) {
      const goRight = pullDeltaX >= 0;
      actualCard.classList.add(goRight ? "go-right" : "go-left");
      actualCard.addEventListener("transitionend", () => {
        actualCard.remove();
      });
    } else {
      actualCard.classList.add("reset");
      actualCard.classList.remove("go-right", "go-left");

      actualCard.querySelectorAll(".choice").forEach((choice) => {
        choice.style.opacity = 0;
      });
    }

    actualCard.addEventListener("transitionend", () => {
      actualCard.removeAttribute("style");
      actualCard.classList.remove("reset");

      pullDeltaX = 0;
      isAnimating = false;
      isDragging = false;
    });

    actualCard
      .querySelectorAll(".choice")
      .forEach((el) => (el.style.opacity = 0));
  }
}

document.addEventListener("mousedown", startDrag);
document.addEventListener("touchstart", startDrag, { passive: true });

document.querySelectorAll("article").forEach((article) => {
  let currentPhotoIndex = 0;
  const photos = JSON.parse(article.getAttribute("data-photos"));

  if (photos.length <= 1) return;

  const progressBarsContainer = article.querySelector(".progress-bars");
  photos.forEach((_, index) => {
    const bar = document.createElement("span");
    bar.className = "progress-bar";
    if (index === 0) bar.classList.add("active");
    progressBarsContainer.appendChild(bar);
  });

  article.addEventListener("click", () => {
    if (isDragging) return; // Do not change the photo if dragging
    currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    const imgEl = article.querySelector("img");
    imgEl.src = photos[currentPhotoIndex];
    updateProgressBars(progressBarsContainer, currentPhotoIndex);
  });
});

function updateProgressBars(progressBarsContainer, currentIndex) {
  const bars = progressBarsContainer.querySelectorAll(".progress-bar");
  bars.forEach((bar, index) => {
    bar.classList.toggle("active", index === currentIndex);
  });
}

document.querySelector("#like").addEventListener("click", (event) => {
    const cards = document.querySelectorAll(".cards article");
    const actualCard = cards[cards.length - 1]; 
    actualCard.classList.add("go-right");
    actualCard.addEventListener("transitionend", () => {
      actualCard.remove();
    });
  });

  document.querySelector("#remove").addEventListener("click", (event) => {
    const cards = document.querySelectorAll(".cards article");
    const actualCard = cards[cards.length - 1]; 
    actualCard.classList.add("go-left");
    actualCard.addEventListener("transitionend", () => {
      actualCard.remove();
    });
  });