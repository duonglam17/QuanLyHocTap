import { render } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/authContext.js';
import { mockAuth } from './mockAuth.js';

export function renderWithProviders(
  ui,
  { auth = mockAuth(), route = '/', ...renderOptions } = {}
) {
  function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    );
  }

  return render(createElement(Wrapper, null, ui), renderOptions);
}

export { mockAuth };
