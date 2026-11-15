/**
 * Tdl (Things to do today) - 할일 등록 / 조회 / 수정 / 삭제
 */
const todo = {
    items: [],        // 할일 목록 [{ uid, date, title, content }]
    tpl: null,        // 항목 템플릿 (최초 1회만 읽어서 재사용)
    editingUid: null, // 수정 중인 할일의 uid (없으면 null)

    // 할일 1개 조회
    get(uid) {
        return this.items.find(item => item.uid === uid) ?? null;
    },

    // 할일 등록
    add(date, title, content) {
        this.items = [...this.items, { uid: Date.now(), date, title, content }];
        this.render();
    },

    // 할일 수정: uid가 같은 항목만 새 값으로 교체
    update(uid, date, title, content) {
        this.items = this.items.map(item =>
            item.uid === uid ? { ...item, date, title, content } : item
        );
        this.render();
    },

    // 할일 삭제: uid가 다른 항목만 남김
    remove(uid) {
        this.items = this.items.filter(item => item.uid !== uid);
        this.render();
    },

    save() {
        // 할일 저장 (localStorage 연동 예정)
    },

    // 템플릿 조회
    getTpl() {
        if (!this.tpl) {
            this.tpl = document.getElementById("tpl").innerHTML;
        }
        return this.tpl;
    },

    // 할일 객체 -> 템플릿의 ${key} 자리에 값을 채운 HTML 문자열
    toHtml(item) {
        return Object.entries(item).reduce(
            (html, [key, value]) => html.replaceAll(`\${${key}}`, value),
            this.getTpl()
        );
    },

    // 화면 갱신
    render() {
        const listEl = document.getElementById("todo-items");
        listEl.innerHTML = this.items.length
            ? this.items.map(item => this.toHtml(item)).join("")
            : `<li class="empty">등록된 할 일이 없습니다.</li>`;
    },
};

window.addEventListener("DOMContentLoaded", () => {
    const form = document.forms.frmTodo;
    const submitBtn = form.querySelector("button[type='submit']");

    // 입력 항목(name)과 비어 있을 때 보여줄 메시지
    const fields = {
        date: "날짜를 선택하세요.",
        task: "제목을 입력하세요.",
        detail: "내용을 입력하세요.",
    };

    // 양식 초기화 + 등록 모드로 되돌리기
    const resetForm = () => {
        form.reset();
        todo.editingUid = null;
        submitBtn.textContent = "등록하기";
    };

    // 등록 / 수정 처리
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const emptyKey = Object.keys(fields).find(key => !form[key].value.trim());
        if (emptyKey) {
            alert(fields[emptyKey]);
            form[emptyKey].focus();
            return;
        }

        const [date, title, content] = Object.keys(fields).map(key => form[key].value.trim());

        if (todo.editingUid) {
            todo.update(todo.editingUid, date, title, content);
        } else {
            todo.add(date, title, content);
        }
        resetForm();
    });

    // 삭제 / 수정 버튼: 목록(ul)에 리스너 1개만 연결 (이벤트 위임)
    document.getElementById("todo-items").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-uid]");
        if (!btn) return;

        const uid = Number(btn.dataset.uid);

        if (btn.classList.contains("delete-action")) {
            if (!confirm("정말 삭제하겠습니까?")) return;
            todo.remove(uid);
            if (todo.editingUid === uid) resetForm();
            return;
        }

        if (btn.classList.contains("edit-action")) {
            const item = todo.get(uid);
            if (!item) return;
            form.date.value = item.date;
            form.task.value = item.title;
            form.detail.value = item.content;
            todo.editingUid = uid;
            submitBtn.textContent = "수정하기";
            form.task.focus();
        }
    });

    todo.render();
});
