import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AccountPageComponent } from './account-page/account-page.component';
import { BalancePageComponent } from './balance-page/balance-page.component';
import { AddCreditPageComponent } from './add-credit-page/add-credit-page.component';

const routes: Routes = [
  { path: 'add-credit', component: AddCreditPageComponent },
  { path: 'settings', component: AccountPageComponent},
  { path: 'balance', component: BalancePageComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountRoutingModule { }
