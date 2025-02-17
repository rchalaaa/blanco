// Constants and state
const DECISION_THRESHOLD = 85;
let isAnimating = false;
let pullDeltaX = 0;
let isDragging = false;

// Preloader utility function
function preloadImages(imageUrls) {
  return imageUrls.map(url => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(url);
      img.src = url;
    });
  });
}

// Get all cards and create a function to preload next card's images
function getCards() {
  return Array.from(document.querySelectorAll('.cards article')).reverse();
}

async function preloadNextCards(currentIndex) {
  const cards = getCards();
  
  // If we're at the last card, no need to preload
  if (currentIndex >= cards.length - 1) return;
  
  // Get next card's photos
  const nextCard = cards[currentIndex + 1];
  if (!nextCard) return;
  
  const nextPhotos = JSON.parse(nextCard.getAttribute('data-photos'));
  
  // Preload all images for the next card
  try {
    await Promise.all(preloadImages(nextPhotos));
    console.log('Preloaded next card images');
  } catch (error) {
    console.error('Error preloading images:', error);
  }
}

// Initial load - preload current and next card images
async function initialPreload() {
  const cards = getCards();
  if (cards.length === 0) return;
  
  // Preload current card
  const currentCard = cards[0];
  const currentPhotos = JSON.parse(currentCard.getAttribute('data-photos'));
  
  try {
    await Promise.all(preloadImages(currentPhotos));
    console.log('Preloaded current card images');
    
    // Preload next card
    await preloadNextCards(0);
  } catch (error) {
    console.error('Error during initial preload:', error);
  }
}

function startDrag(event) {
  if (isAnimating) return;

  const actualCard = event.target.closest("article");
  if (!actualCard) return;

  const startX = event.pageX ?? event.touches[0].pageX;
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
      isDragging = true;

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
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    
    const decisionMade = Math.abs(pullDeltaX) >= DECISION_THRESHOLD;
    
    if (decisionMade) {
      const goRight = pullDeltaX >= 0;
      actualCard.classList.add(goRight ? 'go-right' : 'go-left');
      actualCard.addEventListener('transitionend', () => {
        const cards = getCards();
        const removedIndex = cards.findIndex(card => card === actualCard);
        actualCard.remove();
        // Preload next card's images after removal
        preloadNextCards(removedIndex);
      });
    } else {
      actualCard.classList.add('reset');
      actualCard.classList.remove('go-right', 'go-left');
      
      actualCard.querySelectorAll('.choice').forEach(choice => {
        choice.style.opacity = 0;
      });
    }
    
    actualCard.addEventListener('transitionend', () => {
      actualCard.removeAttribute('style');
      actualCard.classList.remove('reset');
      
      pullDeltaX = 0;
      isAnimating = false;
      isDragging = false;
    });
    
    actualCard.querySelectorAll('.choice').forEach(el => el.style.opacity = 0);
  }
}

// Photo gallery functionality
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
    if (isDragging) return;
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

// Button handlers
document.querySelector("#like").addEventListener("click", (event) => {
  const cards = getCards();
  const actualCard = cards[0];
  const currentIndex = cards.findIndex(card => card === actualCard);
  
  actualCard.classList.add("go-right");
  actualCard.addEventListener("transitionend", () => {
    actualCard.remove();
    preloadNextCards(currentIndex);
  });
});

document.querySelector("#remove").addEventListener("click", (event) => {
  const cards = getCards();
  const actualCard = cards[0];
  const currentIndex = cards.findIndex(card => card === actualCard);
  
  actualCard.classList.add("go-left");
  actualCard.addEventListener("transitionend", () => {
    actualCard.remove();
    preloadNextCards(currentIndex);
  });
});

// Event listeners for drag functionality
document.addEventListener("mousedown", startDrag);
document.addEventListener("touchstart", startDrag, { passive: true });

// Start preloading when the page loads
document.addEventListener('DOMContentLoaded', initialPreload);