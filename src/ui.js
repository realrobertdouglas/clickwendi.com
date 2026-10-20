let lastMenu = "";
let lastMode = "";

export function paint(view) {
  document.body.dataset.mode = view.mode;
  document.body.classList.toggle("match", view.layer === "match");
  document.body.classList.toggle("gauge", view.mode === "gauge");

  const signal = document.querySelector("#signal");
  const objective = document.querySelector("#objective");
  const hearts = document.querySelector("#hearts");
  const caption = document.querySelector("#caption");
  const toast = document.querySelector("#toast");
  const hint = document.querySelector("#hint");
  const flask = document.querySelector("#flask");

  signal.querySelector(".num").textContent = String(view.signal);
  signal.querySelector(".fill").style.width = `${view.signal}%`;
  signal.querySelector(".fill").style.background = view.signal > 60 ? "#3ee0c5" : view.signal > 30 ? "#e2b657" : "#ff5d73";
  objective.textContent = view.objective;
  hearts.replaceChildren(
    ...Array.from({ length: 4 }, (_, i) => {
      const pip = document.createElement("i");
      pip.className = i < view.hp ? "on" : "";
      return pip;
    }),
  );
  flask.hidden = !view.hasFlask;
  const covered = Boolean(view.menu);
  setCaption(caption, covered ? "" : view.speaker, covered ? "" : view.caption);
  setText(toast, covered ? "" : view.toast);
  setText(hint, covered ? "" : view.hint);

  const signature = JSON.stringify(view.menu);
  if (signature !== lastMenu || view.mode !== lastMode) {
    lastMenu = signature;
    lastMode = view.mode;
    renderMenu(view.menu);
  }
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
  node.hidden = !text;
}

function setCaption(caption, speaker, text) {
  const who = caption.querySelector("#who");
  const line = caption.querySelector("#line");
  if (who.textContent !== speaker) who.textContent = speaker;
  who.hidden = !speaker;
  if (line.textContent !== text) line.textContent = text;
  caption.hidden = !text;
}

function renderMenu(menu) {
  const root = document.querySelector("#menu");
  root.replaceChildren();
  if (!menu) return;
  const card = document.createElement("section");
  card.className = "card";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = menu.eyebrow;
  const title = document.createElement("h1");
  title.textContent = menu.title;
  const body = document.createElement("p");
  body.className = "lede";
  body.textContent = menu.body;
  const row = document.createElement("div");
  row.className = "actions";
  for (const action of menu.actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.act = action.id;
    button.textContent = action.label;
    row.append(button);
  }
  card.append(eyebrow, title);
  if (menu.kind === "title") {
    const credit = document.createElement("p");
    credit.className = "credit";
    credit.textContent = "Build by PESSS GAMES";
    card.append(credit);
  }
  if (menu.body) card.append(body);
  if (menu.pages) {
    const log = document.createElement("div");
    log.className = "story-log";
    for (const page of menu.pages) {
      const entry = document.createElement("p");
      if (page.who) {
        const who = document.createElement("span");
        who.className = "who";
        who.textContent = page.who;
        entry.append(who, document.createElement("br"));
      }
      entry.append(document.createTextNode(page.line));
      log.append(entry);
    }
    card.append(log);
  }
  card.append(row);
  if (menu.kind === "title") {
    const keys = document.createElement("p");
    keys.className = "title-keys";
    keys.textContent = "WASD move · Q layer · E use · click or F shoot · C story · checkpoints save in this browser";
    card.append(keys);
  }
  root.append(card);
}
