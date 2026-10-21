export class Student {
  constructor(
    public isuId: number,
    public fio: string,
    public stGroup: string,
    public dormitoryNumber: number,
    public room: number,
    public dateOfPlacement: string,
    public isNotRussian: boolean,
    public notes: string = ''
  ) {}
}
