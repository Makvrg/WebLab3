export class ProfileView {

    render(student) {
        if (!student) {
            const fioEl = document.getElementById("profile-fio");
            if (fioEl) {
                fioEl.textContent = "Студент не найден";
            }
            return;
        }

        document.getElementById("profile-fio").textContent = student.fio;
        document.getElementById("profile-isu").textContent = student.isuId;
        document.getElementById("profile-group").textContent = student.stGroup;
        document.getElementById("profile-dorm").textContent = student.dormitoryNumber;
        document.getElementById("profile-room").textContent = student.room;

        if (student.dateOfPlacement) {
            const dateObj = new Date(student.dateOfPlacement);
            document.getElementById("profile-date").textContent =
                dateObj.toLocaleDateString("ru-RU");
        } else {
            document.getElementById("profile-date").textContent = "-";
        }

        document.getElementById("profile-foreigner").textContent = student.isNotRussian
            ? "Да"
            : "Нет";
        document.getElementById("profile-notes").textContent = student.notes
            ? student.notes
            : "Нет заметок";
    }
}
