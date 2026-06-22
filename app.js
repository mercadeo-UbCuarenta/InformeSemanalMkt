const STORAGE_KEY = "ub40-marketing-report-v9";
const content = document.querySelector("#editableContent");
const footer = document.querySelector("footer");
const editToggle = document.querySelector("#editToggle");
const editLabel = document.querySelector("#editLabel");
const editorPanel = document.querySelector("#editorPanel");
const imagePicker = document.querySelector("#imagePicker");
const galleryPicker = document.querySelector("#galleryPicker");
const toast = document.querySelector("#toast");
const photoViewer = document.querySelector("#photoViewer");
let editing = false;
let activeImage = null;
let activeGalleryCard = null;
let saveTimer;
const actionFilters = {brand:"all"};
const originalContent = content.innerHTML;
const originalFooter = footer.innerHTML;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setEditing(state) {
  editing = state;
  document.body.classList.toggle("edit-mode", state);
  editLabel.textContent = state ? "Finalizar edición" : "Editar informe";
  editorPanel.classList.toggle("open", state);
  editorPanel.setAttribute("aria-hidden", String(!state));
  document.querySelectorAll(".editable").forEach(el => {
    el.contentEditable = state ? "true" : "false";
  });
  if (!state) saveReport();
}

function saveReport(showConfirmation = true) {
  try {
    const payload = createReportPayload();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const stamp = new Date().toLocaleString("es-CO", {dateStyle:"medium", timeStyle:"short"});
    document.querySelector("#saveStatus").textContent = `Último guardado: ${stamp}`;
    if (showConfirmation) showToast("Informe guardado");
  } catch (error) {
    showToast("No fue posible guardar. Reduce el tamaño de las fotos.");
  }
}

function createReportPayload() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    content: content.innerHTML,
    footer: footer.innerHTML
  };
}

function applyReportPayload(payload, label = "Último guardado") {
  if (!payload?.content) throw new Error("Formato inválido");
  content.innerHTML = payload.content;
  footer.innerHTML = payload.footer || originalFooter;
  if (payload.updatedAt) {
    const stamp = new Date(payload.updatedAt).toLocaleString("es-CO", {dateStyle:"medium", timeStyle:"short"});
    document.querySelector("#saveStatus").textContent = `${label}: ${stamp}`;
  }
}

async function restoreReport() {
  if (location.protocol !== "file:") {
    try {
      const response = await fetch(`datos-publicados.json?v=${Date.now()}`, {cache:"no-store"});
      if (response.ok) {
        applyReportPayload(await response.json(), "Publicación cargada");
        return;
      }
    } catch (error) {
      // La publicación todavía no tiene un archivo de datos.
    }
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const payload = JSON.parse(saved);
    applyReportPayload(payload);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveReport(false), 700);
}

function applyActionFilters() {
  let visible = 0;
  document.querySelectorAll(".evidence-card").forEach(card => {
    const brandMatch = actionFilters.brand === "all" || card.dataset.brand === actionFilters.brand;
    const show = brandMatch;
    card.classList.toggle("hidden", !show);
    if (show) visible++;
  });
  document.querySelectorAll("#crmBrandRows tr, #crmCampaignRows tr").forEach(row => {
    if (!row.dataset.brand) return;
    row.hidden = actionFilters.brand !== "all" && row.dataset.brand !== actionFilters.brand;
  });
  window.filterCRMByBrand?.(actionFilters.brand);
  const result = document.querySelector("#filterResult");
  if (result) result.textContent = `${visible} ${visible === 1 ? "acción visible" : "acciones visibles"} · CRM filtrado por marca`;
}

function resetActionFilters() {
  actionFilters.brand = "all";
  document.querySelectorAll(".filter").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === "all");
  });
  applyActionFilters();
}

function openPhotoViewer(image) {
  const card = image.closest(".evidence-card");
  document.querySelector("#photoViewerImage").src = image.src;
  document.querySelector("#photoViewerImage").alt = image.alt;
  document.querySelector("#photoViewerTitle").textContent = card?.querySelector("h3")?.textContent || image.alt;
  document.querySelector("#photoViewerMeta").textContent = [
    card?.querySelector(".card-brand")?.textContent,
    card?.querySelector(".card-action-type")?.textContent
  ].filter(Boolean).join(" · ");
  photoViewer.classList.add("open");
  photoViewer.setAttribute("aria-hidden", "false");
}

function closePhotoViewer() {
  photoViewer.classList.remove("open");
  photoViewer.setAttribute("aria-hidden", "true");
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = event => {
    const image = new Image();
    image.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", .82));
    };
    image.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function syncGalleryMainImage(card, thumb) {
  const main = card.querySelector(".replaceable-image");
  const image = thumb.querySelector("img");
  if (!main || !image) return;
  main.src = image.src;
  main.alt = image.alt;
  card.querySelectorAll(".gallery-thumb").forEach(item => item.classList.toggle("active", item === thumb));
}

function addGalleryImage(card, dataUrl, alt) {
  const gallery = card.querySelector(".evidence-gallery");
  const addButton = gallery.querySelector(".add-gallery-images");
  const thumb = document.createElement("button");
  thumb.className = "gallery-thumb";
  thumb.type = "button";
  thumb.innerHTML = `<img src="${dataUrl}" alt="${alt.replace(/"/g, "&quot;")}"><span class="remove-gallery-image" aria-label="Eliminar foto">×</span>`;
  gallery.insertBefore(thumb, addButton);
  return thumb;
}

function hydrateGalleryControls(root = document) {
  root.querySelectorAll(".gallery-thumb").forEach(thumb => {
    if (!thumb.querySelector(".remove-gallery-image")) {
      const remove = document.createElement("span");
      remove.className = "remove-gallery-image";
      remove.setAttribute("aria-label", "Eliminar foto");
      remove.textContent = "×";
      thumb.appendChild(remove);
    }
  });
}

function exportReport() {
  const payload = localStorage.getItem(STORAGE_KEY) || JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    content: content.innerHTML,
    footer: footer.innerHTML
  });
  const blob = new Blob([payload], {type:"application/json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `informe-marketing-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Respaldo exportado");
}

function preparePublication() {
  saveReport(false);
  const payload = createReportPayload();
  payload.publication = {
    generatedFor: "GitHub Pages",
    repository: "mercadeo-UbCuarenta/InformeSemanalMkt"
  };
  const blob = new Blob([JSON.stringify(payload)], {type:"application/json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "datos-publicados.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Archivo para GitHub preparado");
}

function importReport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload.content) throw new Error("Formato inválido");
      content.innerHTML = payload.content;
      footer.innerHTML = payload.footer || originalFooter;
      saveReport(false);
      setEditing(true);
      showToast("Respaldo importado");
    } catch (error) {
      showToast("El archivo no es un respaldo válido");
    }
  };
  reader.readAsText(file);
}

editToggle.addEventListener("click", () => setEditing(!editing));
document.querySelector("#closeEditor").addEventListener("click", () => setEditing(false));
document.querySelector("#saveReport").addEventListener("click", () => saveReport());
document.querySelector("#preparePublication").addEventListener("click", preparePublication);
document.querySelector("#exportReport").addEventListener("click", exportReport);
document.querySelector("#printReport").addEventListener("click", () => window.print());
document.querySelector("#importReport").addEventListener("change", event => {
  if (event.target.files[0]) importReport(event.target.files[0]);
  event.target.value = "";
});
document.querySelector("#resetReport").addEventListener("click", () => {
  if (!confirm("¿Restaurar el informe de ejemplo? Se perderán los cambios guardados en este navegador.")) return;
  localStorage.removeItem(STORAGE_KEY);
  content.innerHTML = originalContent;
  footer.innerHTML = originalFooter;
  setEditing(true);
  showToast("Ejemplo restaurado");
});

document.addEventListener("input", event => {
  if (editing && event.target.closest(".editable")) queueSave();
});

document.addEventListener("click", event => {
  const addButton = event.target.closest("#addEvidence");
  if (editing && addButton) {
    const template = document.querySelector("#evidenceTemplate");
    const card = template.content.firstElementChild.cloneNode(true);
    document.querySelector("#evidenceGrid").appendChild(card);
    hydrateGalleryControls(card);
    card.scrollIntoView({behavior:"smooth", block:"center"});
    card.querySelector("h3").focus();
    applyActionFilters();
    queueSave();
    return;
  }

  const filter = event.target.closest(".filter");
  if (filter) {
    document.querySelectorAll('.filter[data-filter-group="brand"]').forEach(button => button.classList.remove("active"));
    filter.classList.add("active");
    actionFilters.brand = filter.dataset.filter;
    applyActionFilters();
  }

  const image = event.target.closest(".replaceable-image");
  if (image) {
    if (editing) {
      activeImage = image;
      imagePicker.click();
    } else {
      openPhotoViewer(image);
    }
  }

  const galleryThumb = event.target.closest(".gallery-thumb");
  if (galleryThumb && !event.target.closest(".remove-gallery-image")) {
    const card = galleryThumb.closest(".evidence-card");
    syncGalleryMainImage(card, galleryThumb);
    if (!editing) openPhotoViewer(card.querySelector(".replaceable-image"));
  }

  const addGalleryButton = event.target.closest(".add-gallery-images");
  if (editing && addGalleryButton) {
    activeGalleryCard = addGalleryButton.closest(".evidence-card");
    galleryPicker.click();
  }

  const removeGalleryButton = event.target.closest(".remove-gallery-image");
  if (editing && removeGalleryButton) {
    const thumb = removeGalleryButton.closest(".gallery-thumb");
    const card = thumb.closest(".evidence-card");
    const wasActive = thumb.classList.contains("active");
    thumb.remove();
    if (wasActive) {
      const remaining = card.querySelector(".gallery-thumb");
      if (remaining) syncGalleryMainImage(card, remaining);
    }
    saveReport(false);
    showToast("Fotografía eliminada");
  }

  if (event.target.closest(".photo-viewer-close") || event.target === photoViewer) closePhotoViewer();

  const deleteButton = event.target.closest(".delete-card");
  if (editing && deleteButton) {
    if (confirm("¿Eliminar esta evidencia?")) {
      deleteButton.closest(".evidence-card").remove();
      applyActionFilters();
      saveReport(false);
      showToast("Evidencia eliminada");
    }
  }
});

imagePicker.addEventListener("change", () => {
  const file = imagePicker.files[0];
  if (!file || !activeImage) return;
  compressImage(file, dataUrl => {
    activeImage.src = dataUrl;
    activeImage.alt = file.name.replace(/\.[^.]+$/, "");
    const card = activeImage.closest(".evidence-card");
    const activeThumb = card?.querySelector(".gallery-thumb.active img");
    if (activeThumb) {
      activeThumb.src = dataUrl;
      activeThumb.alt = activeImage.alt;
    }
    saveReport(false);
    showToast("Imagen actualizada");
    activeImage = null;
  });
  imagePicker.value = "";
});

galleryPicker.addEventListener("change", () => {
  const files = Array.from(galleryPicker.files || []);
  if (!files.length || !activeGalleryCard) return;
  let completed = 0;
  files.forEach(file => {
    compressImage(file, dataUrl => {
      const thumb = addGalleryImage(activeGalleryCard, dataUrl, file.name.replace(/\.[^.]+$/, ""));
      completed++;
      if (completed === files.length) {
        syncGalleryMainImage(activeGalleryCard, thumb);
        saveReport(false);
        showToast(`${files.length} ${files.length === 1 ? "foto agregada" : "fotos agregadas"}`);
        activeGalleryCard = null;
      }
    });
  });
  galleryPicker.value = "";
});

window.addEventListener("beforeunload", () => {
  if (editing) saveReport(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closePhotoViewer();
});

async function initializeReport() {
  await restoreReport();
  hydrateGalleryControls();
  applyActionFilters();
}

initializeReport();
window.applyActionFilters = applyActionFilters;
window.resetActionFilters = resetActionFilters;
window.hydrateGalleryControls = hydrateGalleryControls;
