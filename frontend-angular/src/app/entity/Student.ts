export interface StudentFilter {
  isuId?: number | string | null;
  fio?: string | null;
  stGroup?: string | null;
  dormitoryNumber?: number | string | null;
  room?: number | string | null;
  dateOfPlacement?: string | null;
  isNotRussian?: boolean | string | null;
  pageSize?: number;
  pageNumber?: number;
}

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

  static fromJSON(rawData: any): Student {
    return new Student(
      Number(rawData.isuId),
      String(rawData.fio ?? ''),
      String(rawData.stGroup ?? ''),
      Number(rawData.dormitoryNumber),
      Number(rawData.room),
      String(rawData.dateOfPlacement ?? ''),
      Boolean(rawData.isNotRussian),
      rawData.notes ? String(rawData.notes) : ''
    );
  }
}
