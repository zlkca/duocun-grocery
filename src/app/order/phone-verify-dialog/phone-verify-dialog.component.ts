import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar } from '../../../../node_modules/@angular/material';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { Subject } from '../../../../node_modules/rxjs';
import { environment } from '../../../environments/environment';
import { AccountService } from '../../account/account.service';
import { IAccount } from '../../account/account.model';
import { FormBuilder } from '../../../../node_modules/@angular/forms';
import { AuthService } from '../../account/auth.service';

export const AccountType = {
  TEMP: 'tmp', // // For no logged in user who get the verification code, but didn't finish verify
  Driver: 'D'
};

export const VerificationError = {
  NONE: 'N',
  WRONG_CODE: 'WC',
  PHONE_NUMBER_OCCUPIED: 'PO',
  REQUIRE_SIGNUP: 'RS',
  NO_PHONE_NUMBER_BIND: 'NP'
};

export interface DialogData {
  title: string;
  content: string;
  buttonTextNo: string;
  buttonTextYes: string;
  account: IAccount;
  paymentMethod: string;
}

@Component({
  selector: 'app-phone-verify-dialog',
  templateUrl: './phone-verify-dialog.component.html',
  styleUrls: ['./phone-verify-dialog.component.scss']
})
export class PhoneVerifyDialogComponent implements OnInit, OnDestroy {

  account; // current logged in account
  phoneMatchedAccount; // if phoneMatchedAccount.type === tmp,  display signup button
  form;
  verified: boolean;
  // bGettingCode = false;
  bAllowVerify = false;
  verifing = false;
  lang = environment.language;

  get phone() { return this.form.get('phone'); }
  get verificationCode() { return this.form.get('verificationCode'); }

  onDestroy$ = new Subject();
  constructor(
    private authSvc: AuthService,
    private accountSvc: AccountService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PhoneVerifyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.form = this.fb.group({
      phone: [''],
      verificationCode: ['']
    });
    this.account = this.data.account;
  }

  ngOnInit() {

  }

  ngOnDestroy() {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  verifyPhoneNumber(accountId: string, account: IAccount) {
    if (accountId) {
      if (account) {
        // if (account.type === AccountType.TEMP) {
        //   if (accountId === account._id) {
        //     return VerificationError.NONE;
        //   } else {
        //     return VerificationError.PHONE_NUMBER_OCCUPIED;
        //   }
        // } else {
        if (accountId === account._id) {
          return VerificationError.NONE;
        } else {
          return VerificationError.PHONE_NUMBER_OCCUPIED;
        }
        // }
      } else {
        return VerificationError.NONE;
      }
    } else {
      return VerificationError.NONE;
    }
  }

  onVerify() {
    const self = this;
    const code = this.form.value.verificationCode.toString();
    let phone: string = this.form.value.phone;
    phone = phone.substring(0, 2) === '+1' ? phone.substring(2) : phone;
    phone = phone.match(/\d+/g).join('');

    const accountId = self.account ? self.account._id : '';
    this.verifing = true;
    this.accountSvc.verifyPhoneNumber(phone, code, accountId).pipe(takeUntil(this.onDestroy$)).subscribe((r: any) => {
      self.verifing = false;
      self.verified = r.verified;

      if (r.err === VerificationError.NONE) {
        const account = r.account;
        const paymentMethod = this.data.paymentMethod;
        self.authSvc.setAccessTokenId(r.tokenId);
        self.dialogRef.close({ account, paymentMethod });
      } else if (r.err === VerificationError.REQUIRE_SIGNUP) {
        self.phoneMatchedAccount = r.account; // display signup button
      } else {
        self.showError(r.err);
      }
    });
  }

  onPhoneInput(e) {
    const self = this;
    this.verified = false;
    this.verificationCode.patchValue('');

    if (e.target.value && e.target.value.length >= 10) {
      let phone: string = this.form.value.phone;
      phone = phone.substring(0, 2) === '+1' ? phone.substring(2) : phone;
      phone = phone.match(/\d+/g).join('');

      this.accountSvc.find({ phone: phone }).pipe(takeUntil(this.onDestroy$)).subscribe(accounts => {
        const account = (accounts && accounts.length > 0) ? accounts[0] : null;
        const accountId = this.account ? this.account._id : '';
        const err = this.verifyPhoneNumber(accountId, account);

        if (err === VerificationError.PHONE_NUMBER_OCCUPIED) {
          const s = this.lang === 'en' ? 'This phone number has already bind to an wechat account, please try use wechat to login.' :
            '该号码已经被一个英文版的账号使用，请使用英文版登陆; 如果想更改账号请联系客服。';
          alert(s);
          this.bAllowVerify = false;
        } else {
          this.bAllowVerify = true;
        }
      });
    } else { // input less than 10 chars
      this.bAllowVerify = false;
      this.phoneMatchedAccount = null; // if phoneMatchedAccount.type === tmp,  display signup button
    }
  }

  showError(err) {
    let s = '';
    if (err === VerificationError.PHONE_NUMBER_OCCUPIED) {
      s = this.lang === 'en' ? 'This phone number has already bind to an wechat account, please try use wechat to login.' :
        '该号码已经被一个英文版的账号使用，请使用英文版登陆; 如果想更改账号请联系客服。';
    } else if (err === VerificationError.WRONG_CODE) {
      s = this.lang === 'en' ? 'verification code is wrong, please try again.' : '验证码错误，请重新尝试';
    } else if (err === VerificationError.NO_PHONE_NUMBER_BIND) {
      s = this.lang === 'en' ? 'login with phone number failed, please contact our customer service' :
        '使用该电话号码登陆失败，请退出重新从公众号登陆';
    }

    if (s) {
      alert(s);
      // this.snackBar.open('', s, { duration: 1500 });
    }
  }

  onVerificationCodeInput(e) {
    const self = this;
    let phone: string = this.form.value.phone;
    phone = phone.substring(0, 2) === '+1' ? phone.substring(2) : phone;
    phone = phone.match(/\d+/g).join('');

    if (e.target.value && e.target.value.length === 4) {
      const code = e.target.value;
      // const accountId = self.account ? self.account._id : '';
      // this.verifing = true;
      // this.accountSvc.verifyPhoneNumber(phone, code, accountId).pipe(takeUntil(this.onDestroy$)).subscribe((r: any) => {
      //   self.verifing = false;
      //   self.verified = r.verified;

      //   if (r.err === VerificationError.NONE) {
      //     const account = r.account;
      //     const paymentMethod = this.data.paymentMethod;
      //     self.authSvc.setAccessTokenId(r.tokenId);
      //     self.dialogRef.close({ account, paymentMethod });
      //   } else if (r.err === VerificationError.REQUIRE_SIGNUP) {
      //     self.phoneMatchedAccount = r.account; // display signup button
      //   } else {
      //     self.showError(r.err);
      //   }
      // });
    } else {
      this.verified = false;
    }
  }

  sendVerify() {
    if (this.bAllowVerify) {
      const accountId: string = this.account ? this.account._id : '';
      const successHint = this.lang === 'en' ? 'SMS Verification Code sent' : '短信验证码已发送';
      const failedHint = this.lang === 'en' ? 'Account issue, please contact our customer service。' : '账号有问题，请联系客服';
      const lang = this.lang;
      let phone: string = this.form.value.phone;
      phone = phone.substring(0, 2) === '+1' ? phone.substring(2) : phone;
      phone = phone.match(/\d+/g).join('');
      // this.resendVerify(phone).then(tokenId => {
      //   this.bAllowVerify = true;
      // });
      this.accountSvc.sendVerifyMsg(accountId, phone, lang).toPromise().then((tokenId: string) => {
        this.snackBar.open('', successHint, { duration: 1000 });
        // this.bGettingCode = true;
        if (tokenId) { // to allow api call
          this.authSvc.setAccessTokenId(tokenId);
        } else {
          alert(failedHint);
        }
        this.bAllowVerify = true;
      });
    }
  }


  signup() {
    const self = this;
    const phone = this.form.value.phone;
    const code = this.form.value.verificationCode;
    const paymentMethod = this.data.paymentMethod;
    if (phone && code) {
      this.accountSvc.signup(phone, code).pipe(takeUntil(this.onDestroy$)).subscribe((tokenId: any) => {
        if (tokenId) {
          self.authSvc.setAccessTokenId(tokenId);
          self.accountSvc.getCurrentAccount().pipe(takeUntil(this.onDestroy$)).subscribe((account: IAccount) => {
            if (account) {
              self.dialogRef.close({ account, paymentMethod });
              // self.rx.dispatch({ type: AccountActions.UPDATE, payload: account });
            }
            this.snackBar.open('', 'Signup successful', { duration: 1000 });
          });
        } else {

        }
      });
    } else {
      // fail to signup
    }
  }

}
