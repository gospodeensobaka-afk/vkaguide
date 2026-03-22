/* ========================================================
   ===================== MEDIA MODULE ======================
   Урезанная версия — только зоны 1, 2, 3
   ======================================================== */

const photoTimings = {
    "audio/1-2005.m4a": {
        46: { open: "images/president.jpeg" }
    },

    "audio/2-bulak.m4a": {
        3.21:  { open: "images/bulak shas.jpeg" },
        25.16: { open: "images/bulakdo1957.jpeg" }
    },

    "audio/3-ploschad-tisyacheletia.m4a": {
        32.69: { open: "images/parad.jpeg" }
    }
};

const videoTimings = {};

/* === MISSED MEDIA STORAGE === */
let missedMedia = {};
let galleryFlatPhotos = [];

/* ========================================================
   ========== TIMINGS → FULLSCREEN MEDIA HANDLER ===========
   ======================================================== */

function setupPhotoTimingsForAudio(audio, zoneId) {
    const src = audio.src.split("/").pop();
    const key = "audio/" + src;

    const pTimings = photoTimings[key] || null;
    const vTimings = videoTimings[key] || null;

    if (!pTimings && !vTimings) return;

    const shownPhoto = {};
    const shownVideo = {};
    let lastTime = 0;

    audio.ontimeupdate = () => {
        const current = audio.currentTime;

        if (pTimings) {
            for (const timeStr in pTimings) {
                const target = parseFloat(timeStr);
                const cfg = pTimings[timeStr];
                if (!shownPhoto[target] && lastTime < target && current >= target) {
                    shownPhoto[target] = true;
                    tgLog("INFO", `PHOTO TIMING | t:${target}s | ${cfg.open.split("/").pop()}`);
                    showFullscreenMedia(cfg.open, "photo", cfg.duration);
                }
            }
        }

        lastTime = current;
    };
}

/* ========================================================
   ===================== FULLSCREEN MEDIA ==================
   ======================================================== */

function showFullscreenMedia(src, type, duration = null) {
    let overlay = document.getElementById("fsMediaOverlay");
    let media = document.getElementById("fsMediaElement");
    let closeBtn = document.getElementById("fsMediaClose");

    if (!window.__openedFromGallery && !window.__mediaMenuMode) {
        window.__fsGallery = null;
        window.__fsIndex = 0;
    }

    if (!window.__openedFromGallery && !window.__mediaMenuMode) {
        if (window.__currentZoneId !== undefined && window.__currentZoneId !== null) {
            if (!missedMedia[window.__currentZoneId]) {
                missedMedia[window.__currentZoneId] = [];
            }
            if (!missedMedia[window.__currentZoneId].some(m => m.src === src)) {
                missedMedia[window.__currentZoneId].push({ type, src });
            }
        }
    }

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "fsMediaOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(0,0,0,0.9)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "300000";
        document.body.appendChild(overlay);

        media = document.createElement("img");
        media.id = "fsMediaElement";
        media.style.maxWidth = "100%";
        media.style.maxHeight = "100%";
        overlay.appendChild(media);

        closeBtn = document.createElement("button");
        closeBtn.id = "fsMediaClose";
        closeBtn.textContent = "×";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "20px";
        closeBtn.style.right = "20px";
        closeBtn.style.width = "40px";
        closeBtn.style.height = "40px";
        closeBtn.style.borderRadius = "20px";
        closeBtn.style.border = "none";
        closeBtn.style.background = "rgba(0,0,0,0.7)";
        closeBtn.style.color = "white";
        closeBtn.style.fontSize = "24px";
        closeBtn.style.cursor = "pointer";
        closeBtn.onclick = () => { overlay.style.display = "none"; };
        overlay.appendChild(closeBtn);
    }

    if (media.tagName.toLowerCase() !== "img") {
        const newImg = document.createElement("img");
        newImg.id = "fsMediaElement";
        newImg.style.maxWidth = "100%";
        newImg.style.maxHeight = "100%";
        overlay.replaceChild(newImg, media);
        media = newImg;
    }

    media.style.opacity = "0";
    media.style.transform = "translateX(0)";
    media.onload = () => {
        media.style.transition = "opacity 0.15s ease";
        media.style.opacity = "1";
    };
    media.src = src;

    // Свайпы для галереи
    let startX = null;
    let isDragging = false;

    overlay.ontouchstart = (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        media.style.transition = "none";
    };

    overlay.ontouchmove = (e) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        media.style.transform = `translateX(${dx}px)`;
    };

    overlay.ontouchend = (e) => {
        if (!isDragging) return;
        isDragging = false;
        const endX = e.changedTouches[0].clientX;
        const dx = endX - startX;
        media.style.transition = "transform 0.25s ease";

        if (!window.__fsGallery || window.__fsGallery.length < 2) {
            media.style.transform = "translateX(0)";
            return;
        }

        if (dx < -50 && window.__fsIndex < window.__fsGallery.length - 1) {
            media.style.transform = "translateX(-100%)";
            setTimeout(() => {
                window.__openedFromGallery = true;
                window.__fsIndex++;
                showFullscreenMedia(window.__fsGallery[window.__fsIndex], "photo");
            }, 200);
            return;
        }

        if (dx > 50 && window.__fsIndex > 0) {
            media.style.transform = "translateX(100%)";
            setTimeout(() => {
                window.__openedFromGallery = true;
                window.__fsIndex--;
                showFullscreenMedia(window.__fsGallery[window.__fsIndex], "photo");
            }, 200);
            return;
        }

        media.style.transform = "translateX(0)";
    };

    overlay.style.display = "flex";

    if (window.__openedFromGallery) {
        window.__openedFromGallery = false;
        return;
    }

    if (duration) {
        setTimeout(() => {
            if (overlay && overlay.style.display !== "none") {
                overlay.style.display = "none";
            }
        }, duration);
        return;
    }

    setTimeout(() => {
        if (overlay && overlay.style.display !== "none") {
            overlay.style.display = "none";
        }
    }, 3000);
}

/* ========================================================
   ======================== GALLERY ========================
   ======================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const notReadyBtn = document.getElementById("notReadyBtn");
    const galleryOverlay = document.getElementById("galleryOverlay");

    if (!notReadyBtn || !galleryOverlay) return;

    notReadyBtn.onclick = () => {
        galleryOverlay.innerHTML = "";

        const galleryTrack = document.createElement("div");
        galleryTrack.id = "galleryTrack";
        galleryTrack.style.display = "inline-flex";
        galleryTrack.style.flexDirection = "row";
        galleryTrack.style.gap = "12px";
        galleryTrack.style.whiteSpace = "nowrap";
        galleryOverlay.appendChild(galleryTrack);

        const zoneIds = Object.keys(missedMedia)
            .map(id => Number(id))
            .sort((a, b) => b - a);

        const lastThree = zoneIds.slice(0, 3);

        galleryFlatPhotos = [];
        lastThree.forEach(zoneId => {
            const items = missedMedia[zoneId] || [];
            items.filter(m => m.type === "photo").forEach(m => galleryFlatPhotos.push(m.src));
        });

        lastThree.forEach(zoneId => {
            const items = missedMedia[zoneId];
            items.forEach(item => {
                const thumb = document.createElement("div");
                thumb.style.width = "100px";
                thumb.style.height = "100px";
                thumb.style.borderRadius = "10px";
                thumb.style.overflow = "hidden";
                thumb.style.cursor = "pointer";
                thumb.style.background = "#000";
                thumb.style.display = "inline-flex";
                thumb.style.alignItems = "center";
                thumb.style.justifyContent = "center";
                thumb.style.marginRight = "10px";

                const img = document.createElement("img");
                img.src = item.src;
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.objectFit = "cover";
                thumb.appendChild(img);

                thumb.onclick = () => {
                    galleryOverlay.classList.add("hidden");
                    window.__openedFromGallery = true;
                    window.__fsGallery = galleryFlatPhotos;
                    window.__fsIndex = window.__fsGallery.indexOf(item.src);
                    showFullscreenMedia(item.src, item.type);
                };

                galleryTrack.appendChild(thumb);
            });
        });

        galleryOverlay.classList.remove("hidden");

        const closeOnOutsideTap = (e) => {
            if (!galleryOverlay.classList.contains("hidden") &&
                !galleryOverlay.contains(e.target)) {
                galleryOverlay.classList.add("hidden");
                document.removeEventListener("touchend", closeOnOutsideTap);
            }
        };
        setTimeout(() => {
            document.addEventListener("touchend", closeOnOutsideTap);
        }, 300);
    };
});