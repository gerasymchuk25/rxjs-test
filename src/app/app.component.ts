import { AfterViewInit, Component, ElementRef, OnDestroy, Renderer2, ViewChild } from '@angular/core';
import { combineLatest, fromEvent, merge, Observable } from 'rxjs';
import { first, map, skipUntil, startWith, take, takeWhile, withLatestFrom } from 'rxjs/operators';
import { UserData } from './user-data';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy {

  private alive = true;

  @ViewChild('email') emailInput: ElementRef;
  @ViewChild('password') passwordInput: ElementRef;
  @ViewChild('repeatPassword') repeatPasswordInput: ElementRef;
  @ViewChild('submitButton') submitButton: ElementRef;

  constructor(
    public renderer: Renderer2
  ) {
  }

  ngAfterViewInit(): void {
    this.subscribeOnFormChangeAndButtonClick();
  }

  ngOnDestroy(): void {
    this.alive = false;
  }

  subscribeOnFormChangeAndButtonClick(): void {
    const emailValidation$ = this.getValidationObservable(this.emailInput.nativeElement, 'input', 'blur');
    const passwordValidation$ = this.getValidationObservable(this.passwordInput.nativeElement, 'input', 'blur');
    const repeatPasswordValidation$ = this.getRepeatPasswordEventValidationObservable(this.repeatPasswordInput.nativeElement);
    const formValidationObservable$ = combineLatest([emailValidation$, passwordValidation$, repeatPasswordValidation$])
      .pipe(
        map((inputs: HTMLInputElement[]) => {
          const valid = inputs.every((e) => e.validity.valid);
          this.renderer.setProperty(this.submitButton.nativeElement, 'disabled', !valid);
          return {inputs, valid};
        })
      );
    const submitButtonClickObservable$ = fromEvent<MouseEvent>(this.submitButton.nativeElement, 'click');
    submitButtonClickObservable$
      .pipe(
        takeWhile(() => this.alive),
        withLatestFrom(formValidationObservable$)
      )
      .subscribe((result) => {
        const valid = result[1].valid;
        const data = result[1].inputs;
        if (valid && data?.length > 0) {
          alert(JSON.stringify(this.getUserData(data)));
        }
      });
  }

  getUserData(data: HTMLInputElement[]): UserData {
    return {
      email: data[0].value,
      password: data[1].value
    };
  }

  getFromEventObservable(target: any, eventName: string): Observable<HTMLInputElement> {
    return fromEvent<InputEvent>(target, eventName)
      .pipe(
        map((event: InputEvent) => event.target as HTMLInputElement)
      );
  }

  getValidationObservable(el: HTMLInputElement, ...events: string[]): Observable<HTMLInputElement> {
    const mergeArray = [];
    events.forEach((e) => mergeArray.push(
      e === 'blur'
        ? this.getFromEventObservable(el, e)
          .pipe(
            first(),
            takeWhile((input) => !input.value)
          )
        : this.getFromEventObservable(el, e))
    );
    return merge(...mergeArray)
      .pipe(
        map((input: HTMLInputElement) => {
          if (!input.validity.valid) {
            this.validateInput(input, input.validity);
          }
          return input;
        }),
        startWith(el)
      );
  }

  getRepeatPasswordEventValidationObservable(el: HTMLInputElement): Observable<HTMLInputElement> {
    const blurEvent$ = this.getFromEventObservable(el, 'blur')
      .pipe(take(1));
    const inputEvent$ = this.getFromEventObservable(el, 'input');
    const repeatPasswordEvents$ = merge(
      inputEvent$.pipe(skipUntil(blurEvent$)),
      blurEvent$
    );
    const passwordInputEvent$ = this.getFromEventObservable(this.passwordInput.nativeElement, 'input')
      .pipe(startWith(this.passwordInput.nativeElement));
    return combineLatest([repeatPasswordEvents$, passwordInputEvent$])
      .pipe(
        map((input: HTMLInputElement[]) => {
          const repeatPasswordInput = input[0];
          const passwordInput = input[1];
          const valid = repeatPasswordInput.value === passwordInput.value;
          valid ? repeatPasswordInput.setCustomValidity('') : repeatPasswordInput.setCustomValidity('Password do not match');
          this.validateInput(repeatPasswordInput, repeatPasswordInput.validity);
          return repeatPasswordInput;
        }),
        startWith(el)
      );
  }

  validateInput(input: HTMLInputElement, validity: ValidityState): void {
    const formGroup = input.closest('.form-group') as HTMLDivElement;
    const labelElement = formGroup.querySelector('label') as HTMLLabelElement;
    const errorElement = formGroup.querySelector('.invalid-feedback') as HTMLSpanElement;
    formGroup.classList.remove(validity.valid ? 'was-validated' : 'needs-validation');
    formGroup.classList.add(validity.valid ? 'needs-validation' : 'was-validated');
    errorElement.textContent = this.getErrorMessage(input, validity, labelElement);
  }

  getErrorMessage(input: HTMLInputElement, validity: ValidityState, label: HTMLLabelElement): string {
    if (validity.valueMissing) {
      return `${label.textContent} is required.`;
    }
    if (validity.patternMismatch) {
      return 'Wrong email format';
    }
    if (validity.tooShort) {
      return 'Too short password';
    }
    if (validity.customError) {
      return input.validationMessage;
    }
    return '';
  }
}
