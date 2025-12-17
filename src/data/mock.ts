import type { Shift, Store, User, Schedule, LeaveRequest } from '../types';
import { addDays, format, startOfWeek } from 'date-fns';

export const STORES: Store[] = [
    { id: '1', name: '台北信義店', lat: 25.0330, lng: 121.5654, radius: 30 }, // Near Taipei 101
    { id: '2', name: '新北板橋店', lat: 25.0143, lng: 121.4623, radius: 30 },
    { id: '3', name: '桃園中壢店', lat: 24.9536, lng: 121.2257, radius: 30 },
    { id: '4', name: '台中逢甲店', lat: 24.1789, lng: 120.6465, radius: 30 },
    { id: '5', name: '高雄巨蛋店', lat: 22.6659, lng: 120.3023, radius: 30 },
];

export const SHIFTS: Shift[] = [
    { id: 'morning', name: '早班', startTime: '07:00', endTime: '16:30', type: 'morning' },
    { id: 'middle', name: '中班', startTime: '16:15', endTime: '01:45', type: 'middle' }, // 系統顯示 25:45
    { id: 'night', name: '大夜', startTime: '01:30', endTime: '07:00', type: 'night' },
];

export const MOCK_USERS: User[] = [
    { id: 'admin1', name: '店長', role: 'admin', storeId: '1' },
    { id: 'emp1', name: '王小明', role: 'employee', storeId: '1' },
    { id: 'emp2', name: '李大華', role: 'employee', storeId: '1' },
    { id: 'emp3', name: '陳美麗', role: 'employee', storeId: '2' },
];

const today = new Date();
const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // 週一開始

export const MOCK_SCHEDULES: Schedule[] = [
    // 王小明 (emp1) 本週排班
    {
        id: 's1',
        date: format(addDays(startOfCurrentWeek, 0), 'yyyy-MM-dd'), // 週一
        userId: 'emp1',
        shiftId: 'morning',
        storeId: '1',
        isOpenForSub: false
    },
    {
        id: 's2',
        date: format(addDays(startOfCurrentWeek, 1), 'yyyy-MM-dd'), // 週二
        userId: 'emp1',
        shiftId: 'morning',
        storeId: '1',
        isOpenForSub: false
    },
    {
        id: 's3',
        date: format(addDays(startOfCurrentWeek, 2), 'yyyy-MM-dd'), // 週三 (釋出代班)
        userId: 'emp1',
        shiftId: 'morning',
        storeId: '1',
        isOpenForSub: true
    },

    // 李大華 (emp2) 本週排班
    {
        id: 's4',
        date: format(addDays(startOfCurrentWeek, 0), 'yyyy-MM-dd'), // 週一
        userId: 'emp2',
        shiftId: 'middle',
        storeId: '1',
        isOpenForSub: false
    },
    {
        id: 's5',
        date: format(addDays(startOfCurrentWeek, 2), 'yyyy-MM-dd'), // 週三
        userId: 'emp2',
        shiftId: 'middle',
        storeId: '1',
        isOpenForSub: false
    },
];

export const MOCK_LEAVES: LeaveRequest[] = [
    {
        id: 'l1',
        userId: 'emp1',
        type: '病假',
        startDate: format(addDays(today, -5), 'yyyy-MM-dd'),
        endDate: format(addDays(today, -5), 'yyyy-MM-dd'),
        reason: '感冒發燒',
        status: 'approved'
    },
    {
        id: 'l2',
        userId: 'emp1',
        type: '事假',
        startDate: format(addDays(today, 10), 'yyyy-MM-dd'),
        endDate: format(addDays(today, 11), 'yyyy-MM-dd'),
        reason: '家裡有事',
        status: 'pending'
    }
];
