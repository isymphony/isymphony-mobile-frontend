import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import InitialPage from '../views/InitialPage.vue'; 
import HomePage from '../views/HomePage.vue'
import LoginPage from '../views/LoginPage.vue';
import HourEntryPage from '../views/HourEntryPage.vue';
import ClockEntryPage from '../views/ClockEntryPage.vue';
import AssignmentGatePage from '../views/AssignmentGatePage.vue';
import PendingTimesheetClockEntryPage from '../views/PendingTimesheetClockEntryPage.vue';
import TimesheetClockEntryDetailPage from '../views/TimesheetClockEntryDetailPage.vue';
import ApprovedTimesheetPage from '../views/ApprovedTimesheetPage.vue';
import ApprovedExpensePage from '../views/ApprovedExpensePage.vue';
import MyProfilePage from '../views/MyProfilePage.vue';
import { Preferences } from '@capacitor/preferences';
import App from '@/App.vue';
import ReviewTimesheetPage from '@/views/ReviewTimesheetPage.vue';
import PendingTimesheetPage from '@/views/PendingTimesheetPage.vue';
import WeeklyGridEntryPage from '@/views/WeeklyGridEntryPage.vue';
import MyPtoPage from '@/views/MyPtoPage.vue';
import ViewPTOHistoryPage from '@/views/ViewPTOHistoryPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    component: LoginPage
  },
  {
    path: '/profile-verify',
    component: () => import('../views/ProfileVerifyPage.vue')
  },
  {
    path: '/verify-code',
    component: () => import('../views/VerifyCodePage.vue')
  },
  {
    path: "/initial",
    component: InitialPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/hour-entry',
    component: HourEntryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/weekly-grid-entry',
    component: WeeklyGridEntryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/review-timesheet',
    component: ReviewTimesheetPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/pending-timesheet',
    component: PendingTimesheetPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/clock-entry',
    component: ClockEntryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/assignment-gate',
    component: AssignmentGatePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/pending-clock-timesheet',
    component: PendingTimesheetClockEntryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/approved-timesheets',
    component: ApprovedTimesheetPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/approved-expenses',
    component: ApprovedExpensePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/timesheet-clock-detail/:weekend',
    component: TimesheetClockEntryDetailPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/my-pto',
    component: MyPtoPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/view-pto-history',
    component: ViewPTOHistoryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/my-profile',
    name: 'My Profile',
    component: MyProfilePage,
    meta: { requiresAuth: true }
  }  
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// GLOBAL ROUTE GUARD
router.beforeEach(async (to, from, next) => {
  const tokenResult = await Preferences.get({ key: 'authToken' });
  const token = tokenResult.value;

  const defaultAssignment = await Preferences.get({ key: "defaultAssignmentId" });

  // 1️. If route requires login but there is not a token → redirect to login
  if (to.meta.requiresAuth && !token) {
    return next('/login');
  }

  // 2. If Logged in but no assignment selected
  if (token && !defaultAssignment.value && to.path !== "/initial") {
    return next("/initial");
  }

  // 3. If logged in but user still want to go to /login, /profile-verify, /verify-code → redirect home
  if (token && (to.path === '/login' || to.path === '/profile-verify' || to.path === '/verify-code')) {
    return next('/home');
  }

  next();
});

export default router;
