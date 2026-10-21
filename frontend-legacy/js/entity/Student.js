export class Student {

    isuId;
    fio;
    stGroup;
    dormitoryNumber;
    room;
    dateOfPlacement;
    isNotRussian;
    notes;

    constructor(isuId, fio, stGroup, dormitoryNumber, room,
                dateOfPlacement, isNotRussian, notes) {
        this.isuId = isuId;
        this.fio = fio;
        this.stGroup = stGroup;
        this.dormitoryNumber = dormitoryNumber;
        this.room = room;
        this.dateOfPlacement = dateOfPlacement;
        this.isNotRussian = isNotRussian;
        this.notes = notes;
    }

    static fromJSON(rawData) {
    if (!rawData) return null;

    return new Student(
        rawData.isuId,
        rawData.fio,
        rawData.stGroup,
        rawData.dormitoryNumber,
        rawData.room,
        rawData.dateOfPlacement,
        rawData.isNotRussian,
        rawData.notes
    );
    }

    toJSON() {
        return {
            isuId: this.isuId,
            fio: this.fio,
            stGroup: this.stGroup,
            dormitoryNumber: this.dormitoryNumber,
            room: this.room,
            dateOfPlacement: this.dateOfPlacement,
            isNotRussian: this.isNotRussian,
            notes: this.notes
        };
    }
}
